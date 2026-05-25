/**
 * Lily — poetic quote book
 * jQuery-first: DOM, events, and data loading; native APIs only where jQuery has no equivalent.
 */
// prevent right click
// document.addEventListener('contextmenu', (e) => {
//     e.preventDefault();
// });

(function ($) {
    "use strict";

    const STORAGE_KEY = "lily_reading_state";
    const STORAGE_VERSION = 1;

    const $cover = () => $("#cover");
    const $bookShell = () => $("#book-shell");
    const $book = () => $("#book");

    let quotes = [];
    let scrollSaveTimer = null;
    let scrollRaf = null;
    let pendingScrollTop = null;
    let intersectionObserver = null;
    let currentPageIndex = 0;

    function readStoredState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || data.version !== STORAGE_VERSION) return null;
            return data;
        } catch {
            return null;
        }
    }

    function writeStoredState(partial) {
        const prev = readStoredState() || {};
        const next = {
            version: STORAGE_VERSION,
            bookOpen:
                typeof partial.bookOpen === "boolean" ? partial.bookOpen : Boolean(prev.bookOpen),
            scrollTop:
                typeof partial.scrollTop === "number" && !Number.isNaN(partial.scrollTop)
                    ? partial.scrollTop
                    : typeof prev.scrollTop === "number" && !Number.isNaN(prev.scrollTop)
                        ? prev.scrollTop
                        : 0,
            pageIndex:
                typeof partial.pageIndex === "number" && !Number.isNaN(partial.pageIndex)
                    ? partial.pageIndex
                    : typeof prev.pageIndex === "number" && !Number.isNaN(prev.pageIndex)
                        ? prev.pageIndex
                        : 0,
            timestamp: Date.now(),
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            /* quota or private mode */
        }
    }

    function formatDisplayDate(iso) {
        if (!iso || typeof iso !== "string") return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(d);
    }

    function loadQuotes() {
        return $.ajax({
            url: "./quotes.json",
            dataType: "json",
            cache: false,
        }).then(function (data) {
            if (!Array.isArray(data)) {
                throw new Error("Invalid quotes format");
            }
            return data;
        });
    }

    function createQuotePage(quote, index, total) {
        const safeTitle = quote.title != null ? String(quote.title) : "";
        const label = "Quote " + (index + 1) + " of " + total + ": " + (safeTitle.trim() || "");
        const authorText = quote.author != null ? String(quote.author).trim() : "";

        const $article = $("<article>", {
            class: "quote-page",
            "data-index": String(index),
            role: "article",
            "aria-label": label,
        });

        const $title = $("<h2>", { class: "quote-card__title" }).text(safeTitle.trim() || "");
        const $body = $("<div>", { class: "quote-card__body" }).text(
            quote.content != null ? String(quote.content) : ""
        );

        const $author = $("<span>", { class: "quote-card__author" });
        if (authorText) {
            $author.text(authorText);
        }

        const $time = $("<time>", { class: "quote-card__date" });
        if (quote.createdAt) {
            $time.attr("datetime", String(quote.createdAt));
        }
        $time.text(formatDisplayDate(quote.createdAt) || "");

        const $meta = $("<div>", { class: "quote-card__meta" }).append($author, $time);
        const $flower = `<div class="page-flower">
                <img src="./media/imgs/lily_02.png" alt="Illustration of a lily"/>
            </div>`;
        const $flourish = $("<div>", {
            class: "quote-card__flourish",
            "aria-hidden": "true",
        }).append($flower);

        const language = quote.language != null ? String(quote.language).trim() : "";
        const serifFont = language == "eng" ? "font-serif" : "";

        const $card = $("<div>", { class: "quote-card " + serifFont }).append($title, $body, $meta, $flourish);

        $article.append($card);
        return $article;
    }

    function renderBook(list) {
        const $b = $book();
        if (!$b.length) return;

        $b.empty();
        list.forEach(function (q, i) {
            $b.append(createQuotePage(q, i, list.length));
        });

        $("#total-pages").text(String(list.length));
        updateCurrentPage(0);
    }

    function updateCurrentPage(index) {
        const total = quotes.length;
        if (total === 0) return;
        const clamped = Math.max(0, Math.min(total - 1, index));
        currentPageIndex = clamped;
        $("#current-page").text(String(clamped + 1));
        $("#total-pages").text(String(total));
    }

    function getPageElements() {
        return $book().find(".quote-page").get();
    }

    function setupIntersectionTracking() {
        const bookNode = $book().get(0);
        if (!bookNode) return;

        if (intersectionObserver) {
            intersectionObserver.disconnect();
        }

        const pages = getPageElements();
        if (pages.length === 0) return;

        intersectionObserver = new IntersectionObserver(
            function (entries) {
                const visible = entries
                    .filter(function (e) {
                        return e.isIntersecting && e.intersectionRatio >= 0.45;
                    })
                    .sort(function (a, b) {
                        return b.intersectionRatio - a.intersectionRatio;
                    });

                if (visible.length === 0) return;
                const idx = parseInt($(visible[0].target).attr("data-index"), 10);
                if (!Number.isNaN(idx)) {
                    updateCurrentPage(idx);
                }
            },
            { root: bookNode, threshold: [0.25, 0.45, 0.55, 0.75] }
        );

        $(pages).each(function () {
            intersectionObserver.observe(this);
        });
    }

    function saveReadingPosition() {
        const $b = $book();
        const $shell = $bookShell();
        if (!$b.length || !$shell.length || $shell.hasClass("book-shell--hidden")) return;

        writeStoredState({
            bookOpen: true,
            scrollTop: $b.prop("scrollTop"),
            pageIndex: currentPageIndex,
        });
    }

    function scheduleSaveReadingPosition() {
        if (scrollSaveTimer) {
            clearTimeout(scrollSaveTimer);
        }
        scrollSaveTimer = setTimeout(saveReadingPosition, 160);
    }

    function handleScrollTracking() {
        const $b = $book();
        if (!$b.length) return;

        $b.off("scroll.lily").on("scroll.lily", function () {
            if (scrollRaf) {
                cancelAnimationFrame(scrollRaf);
            }
            scrollRaf = requestAnimationFrame(function () {
                scheduleSaveReadingPosition();
            });
        });
    }

    function restoreReadingPosition() {
        const $b = $book();
        const bookNode = $b.get(0);
        if (!bookNode) return;

        const stored = readStoredState();
        if (!stored || !stored.bookOpen) return;

        const pages = getPageElements();
        const maxScroll = Math.max(0, bookNode.scrollHeight - bookNode.clientHeight);

        let target =
            typeof stored.scrollTop === "number" && !Number.isNaN(stored.scrollTop)
                ? stored.scrollTop
                : 0;

        const idx =
            typeof stored.pageIndex === "number" && !Number.isNaN(stored.pageIndex)
                ? stored.pageIndex
                : 0;

        if (target < 1 && idx > 0 && pages[idx]) {
            pages[idx].scrollIntoView({ behavior: "instant", block: "start" });
            updateCurrentPage(idx);
            writeStoredState({
                bookOpen: true,
                scrollTop: $b.prop("scrollTop"),
                pageIndex: idx,
            });
            return;
        }

        target = Math.min(Math.max(0, target), maxScroll);
        pendingScrollTop = target;

        const apply = function () {
            $b.prop("scrollTop", pendingScrollTop);
            const after = $b.prop("scrollTop");
            writeStoredState({
                bookOpen: true,
                scrollTop: after,
                pageIndex: currentPageIndex,
            });
            pendingScrollTop = null;
        };

        requestAnimationFrame(function () {
            requestAnimationFrame(apply);
        });
    }

    function setBookUiOpen(isOpen) {
        const $c = $cover();
        const $shell = $bookShell();
        const $b = $book();
        if (!$c.length || !$shell.length || !$b.length) return;

        if (isOpen) {
            $("body").addClass("is-book-open");
            $c.addClass("cover--leaving").attr({
                "aria-hidden": "true",
                inert: "",
            });
            $shell.removeClass("book-shell--hidden").removeAttr("aria-hidden").removeAttr("inert");
            $b.attr("tabindex", "-1");
        } else {
            $("body").removeClass("is-book-open");
            $c.removeClass("cover--leaving").removeAttr("aria-hidden").removeAttr("inert");
            $shell.addClass("book-shell--hidden").attr({
                "aria-hidden": "true",
                inert: "",
            });
        }
    }

    function openBook(options) {
        options = options || {};
        const withTransitionFocus = options.withTransitionFocus !== false;

        const $b = $book();
        const prev = readStoredState() || {};
        const bookNode = $b.get(0);

        let mergedScroll = 0;
        if (bookNode && $b.prop("scrollTop") > 2) {
            mergedScroll = $b.prop("scrollTop");
        } else if (typeof prev.scrollTop === "number" && !Number.isNaN(prev.scrollTop)) {
            mergedScroll = prev.scrollTop;
        }

        let mergedPage = currentPageIndex;
        if (typeof prev.pageIndex === "number" && !Number.isNaN(prev.pageIndex)) {
            mergedPage = prev.pageIndex;
        }

        writeStoredState({
            bookOpen: true,
            scrollTop: mergedScroll,
            pageIndex: mergedPage,
        });

        setBookUiOpen(true);
        updateCurrentPage(mergedPage);

        if (bookNode && withTransitionFocus) {
            window.setTimeout(function () {
                bookNode.focus({ preventScroll: true });
            }, 320);
        }
    }

    function closeBookToCover() {
        const $b = $book();
        writeStoredState({
            bookOpen: false,
            scrollTop: $b.length ? $b.prop("scrollTop") : 0,
            pageIndex: currentPageIndex,
        });
        setBookUiOpen(false);

        window.setTimeout(function () {
            $("#open-book").trigger("focus");
        }, 200);
    }

    function scrollToPageIndex(index, smooth) {
        const pages = getPageElements();
        if (!pages.length) return;
        const clamped = Math.max(0, Math.min(pages.length - 1, index));
        pages[clamped].scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "start" });
        updateCurrentPage(clamped);
    }

    function bindKeyboardNavigation() {
        $(document).on("keydown.lily", function (e) {
            const $shell = $bookShell();
            if (!$shell.length || $shell.hasClass("book-shell--hidden")) return;

            if (!$book().length) return;

            const $t = $(e.target);
            if ($t.is("input,textarea")) return;

            let handled = false;
            switch (e.key) {
                case "ArrowDown":
                case "PageDown":
                    scrollToPageIndex(currentPageIndex + 1, true);
                    handled = true;
                    break;
                case "ArrowUp":
                case "PageUp":
                    scrollToPageIndex(currentPageIndex - 1, true);
                    handled = true;
                    break;
                case "Home":
                    scrollToPageIndex(0, true);
                    handled = true;
                    break;
                case "End":
                    scrollToPageIndex(quotes.length - 1, true);
                    handled = true;
                    break;
                default:
                    break;
            }

            if (handled) {
                e.preventDefault();
            }
        });
    }

    function showToast(message) {
        $("#toast")
            .text(message)
            .addClass("is-visible");
        window.clearTimeout(showToast._timer);
        showToast._timer = window.setTimeout(function () {
            $("#toast").removeClass("is-visible");
        }, 2200);
    }

    function init() {
        const stored = readStoredState();

        $.when(loadQuotes())
            .done(function (data) {
                quotes = data;
            })
            .fail(function (jqXHR, textStatus, err) {
                showToast("Could not load quotes. Please refresh.");
                console.error(textStatus, err);
                quotes = [];
            })
            .always(function () {
                renderBook(quotes);
                handleScrollTracking();
                setupIntersectionTracking();
                bindKeyboardNavigation();

                if (stored && stored.bookOpen) {
                    openBook({ withTransitionFocus: false });
                    requestAnimationFrame(function () {
                        restoreReadingPosition();
                        setupIntersectionTracking();
                    });
                    window.setTimeout(function () {
                        const node = $book().get(0);
                        if (node) node.focus({ preventScroll: true });
                    }, 60);
                }

                $("html").removeClass("lily-boot--book");

                $(".skip-link").on("click", function (e) {
                    const $shell = $bookShell();
                    if ($shell.length && $shell.hasClass("book-shell--hidden")) {
                        e.preventDefault();
                        openBook({ withTransitionFocus: true });
                        requestAnimationFrame(function () {
                            restoreReadingPosition();
                            setupIntersectionTracking();
                            const n = $book().get(0);
                            if (n) n.focus({ preventScroll: true });
                        });
                    }
                });

                $("#open-book").on("click", function () {
                    openBook({ withTransitionFocus: true });
                    requestAnimationFrame(function () {
                        restoreReadingPosition();
                        setupIntersectionTracking();
                    });
                });

                $("#to-cover").on("click", function () {
                    closeBookToCover();
                });

                $(window).on("beforeunload.lily", saveReadingPosition);

                $(window).on(
                    "resize.lily",
                    debounce(function () {
                        if (!$bookShell().hasClass("book-shell--hidden")) {
                            scheduleSaveReadingPosition();
                        }
                    }, 200)
                );
            });
    }

    function debounce(fn, ms) {
        let t;
        return function () {
            const ctx = this;
            const args = arguments;
            clearTimeout(t);
            t = setTimeout(function () {
                fn.apply(ctx, args);
            }, ms);
        };
    }

    $(init);
})(jQuery);
