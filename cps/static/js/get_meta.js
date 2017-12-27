/*
 * Get Metadata from Douban Books api and Google Books api
 * Created by idalin<dalin.lin@gmail.com>
 * Google Books api document: https://developers.google.com/books/docs/v1/using
 * Douban Books api document: https://developers.douban.com/wiki/?title=book_v2 (Chinese Only)
*/
/* global _, i18nMsg, tinymce */

var results = {
    douban: [],
    google: []
};

var apis = {
    douban: {
        searchUrl: function (title) {
            return "https://api.douban.com/v2/book/search?q=" + title + "&fields=all&count=10";
        },
        getResults: function (data) {
            return data.books;
        },
        getBook: function (result) {
            return {
                id: result.id,
                title: result.title,
                authors: result.author || [],
                description: result.summary,
                publisher: result.publisher || "",
                publishedDate: result.pubdate || "",
                tags: result.tags.map(function(tag) {
                    return tag.title;
                }),
                rating: result.rating.average || 0,
                cover: result.image,
                url: "https://book.douban.com/subject/" + result.id,
                source: {
                    id: "douban",
                    description: "Douban Books",
                    url: "https://book.douban.com/"
                }
            };
        }
    },
    google: {
        searchUrl: function (title) {
            return "https://www.googleapis.com/books/v1/volumes?q=" + title.replace(/\s+/gm, "+");
        },
        getResults: function (data) {
            return data.items;
        },
        getBook: function (result) {
            return {
                id: result.id,
                title: result.volumeInfo.title,
                authors: result.volumeInfo.authors || [],
                description: result.volumeInfo.description || "",
                publisher: result.volumeInfo.publisher || "",
                publishedDate: result.volumeInfo.publishedDate || "",
                tags: result.volumeInfo.categories || [],
                rating: result.volumeInfo.averageRating || 0,
                cover: result.volumeInfo.imageLinks ?
                    result.volumeInfo.imageLinks.thumbnail :
                    "/static/generic_cover.jpg",
                url: "https://books.google.com/books?id=" + result.id,
                source: {
                    id: "google",
                    description: "Google Books",
                    url: "https://books.google.com/"
                }
            };
        }
    }
};

var goodreadsReady = typeof goodreadsToken !== "undefined" && goodreadsToken !== "";

if (goodreadsReady) {
    results.goodreads = [];
    apis.goodreads = {
        searchUrl: function (title) {
            var goodreadsUrl = "https://www.goodreads.com/search/index.xml?key=" +
                                goodreadsToken + "&q=" + title.replace(/\s+/gm, "+");
            return "https://query.yahooapis.com/v1/public/yql" +
                    "?q=" + encodeURIComponent("select * from xml where url='" + goodreadsUrl + "'") +
                    "&format=xml";
        },
        getResults: function (data) {
            return [].slice.call($($.parseXML(data.results[0])).find('GoodreadsResponse search results work'));
        },
        getBook: function (result) {
            var $result = $(result);
            var text = function (selector) { return $result.find(selector).text(); }
            var id = text("best_book > id");
            return {
                id: id,
                title: text("best_book > title"),
                authors: [text("best_book > author > name")],
                description: "",
                publisher: "",
                publishedDate: text("original_publication_year") + "-" +
                                ("00" + text("original_publication_month")).substr(-2, 2) + "-" +
                                ("00" + text("original_publication_day")).substr(-2, 2),
                tags: [],
                rating: text("average_rating") ? parseFloat(text("average_rating")) : 0,
                cover: text("best_book > image_url").replace(new RegExp("m(\/" + id + "\.(jpe?g|png|gif))$", "i"), "l$1"),
                url: "https://www.goodreads.com/book/show/" + id,
                source: {
                    id: "goodreads",
                    description: "Goodreads",
                    url: "https://www.goodreads.com/"
                }
            };
        }
    };
}

$(function () {
    var msg = i18nMsg;
    var templates = {
        bookResult: _.template(
            $("#template-book-result").html()
        )
    };

    function populateForm (book) {
        tinymce.get("description").setContent(book.description);
        $("#bookAuthor").val(book.authors);
        $("#book_title").val(book.title);
        $("#tags").val(book.tags.join(","));
        $("#rating").data("rating").setValue(Math.round(book.rating));
        $(".cover img").attr("src", book.cover);
        $("#cover_url").val(book.cover);
    }

    function showResult () {
        $("#meta-info").html("<ul id=\"book-list\" class=\"media-list\"></ul>");
        if (Object.keys(apis).every(function (api) { return !results[api]; })) {
            $("#meta-info").html("<p class=\"text-danger\">" + msg.no_result + "</p>");
            return;
        }
        $("#meta-info").html("<ul id=\"book-list\" class=\"media-list\"></ul>");
        Object.keys(apis).forEach(function (api) {
            results[api].forEach(function (result) {
                var book = apis[api].getBook(result);

                var $book = $(templates.bookResult(book));
                $book.find("img").on("click", function () {
                    populateForm(book);
                });

                $("#book-list").append($book);
            });

            $("#show-" + api).trigger("change");
        });
    }

    function searchBook (title, api) {
        $.ajax({
            url: apis[api].searchUrl(title),
            type: "GET",
            dataType: "jsonp",
            jsonp: "callback",
            success: function success(data) {
                results[api] = apis[api].getResults(data);
            },
            error: function error() {
                $("#meta-info").html("<p class=\"text-danger\">" + msg.search_error + "!</p>");
            },
            complete: showResult
        });
    }

    function doSearch (keyword) {
        $("#meta-info").text(msg.loading);
        if (!goodreadsReady) {
            $('#show-goodreads, label[for="show-goodreads"]').remove();
        }
        if (keyword) {
            Object.keys(apis).forEach(function(api) {
                searchBook(keyword, api);
            });
        }
    }

    $("#meta-search").on("submit", function (e) {
        e.preventDefault();
        var keyword = $("#keyword").val();
        if (keyword) {
            doSearch(keyword);
        }
    });

    $("#get_meta").click(function () {
        var bookTitle = $("#book_title").val();
        if (bookTitle) {
            $("#keyword").val(bookTitle);
            doSearch(bookTitle);
        }
    });

});
