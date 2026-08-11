/**
 * For Lily — Mikrokosmos
 * One quote per page; swipe / buttons / keyboard navigation.
 */
(function () {
    "use strict";

    const STORAGE_KEY = "for_lily_reader_v1";
    const QUOTES_URL = "./quotes.json";

    const cover = document.getElementById("cover");
    const reader = document.getElementById("reader");
    const enterBtn = document.getElementById("enter-btn");
    const backBtn = document.getElementById("back-cover");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const quoteCard = document.getElementById("quote-card");
    const quoteTitle = document.getElementById("quote-title");
    const quoteBody = document.getElementById("quote-body");
    const quoteAuthor = document.getElementById("quote-author");
    const pageCount = document.getElementById("page-count");
    const progressFill = document.getElementById("progress-fill");
    const swipeHint = document.getElementById("swipe-hint");
    const starsRoot = document.getElementById("sky-stars");
    const petalsRoot = document.getElementById("sky-petals");
    const quoteStage = document.getElementById("quote-stage");

    let quotes = [];
    let index = 0;
    let animating = false;
    let hintTimer = null;

    function readState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function writeState(partial) {
        const prev = readState() || {};
        const next = {
            open: typeof partial.open === "boolean" ? partial.open : Boolean(prev.open),
            index:
                typeof partial.index === "number" && !Number.isNaN(partial.index)
                    ? partial.index
                    : typeof prev.index === "number"
                      ? prev.index
                      : 0,
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            /* ignore quota / private mode */
        }
    }

    function looksMyanmar(text) {
        return /[\u1000-\u109F]/.test(text || "");
    }

    function spawnAtmosphere() {
        if (!starsRoot || !petalsRoot) return;

        const starCount = 28;
        const petalCount = 16;
        const fragStars = document.createDocumentFragment();
        const fragPetals = document.createDocumentFragment();

        for (let i = 0; i < starCount; i += 1) {
            const star = document.createElement("span");
            star.className = "star";
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;
            star.style.setProperty("--twinkle", `${2.4 + Math.random() * 3.2}s`);
            star.style.animationDelay = `${Math.random() * 4}s`;
            fragStars.appendChild(star);
        }

        for (let i = 0; i < petalCount; i += 1) {
            const petal = document.createElement("span");
            const size = 8 + Math.random() * 10;
            petal.className = Math.random() > 0.55 ? "petal petal--soft" : "petal";
            petal.style.left = `${Math.random() * 100}%`;
            petal.style.setProperty("--petal-w", `${size}px`);
            petal.style.setProperty("--petal-h", `${size * 1.35}px`);
            petal.style.setProperty("--petal-opacity", String(0.4 + Math.random() * 0.35));
            petal.style.setProperty("--fall", `${8 + Math.random() * 10}s`);
            petal.style.setProperty("--drift-x", `${-50 + Math.random() * 100}px`);
            petal.style.setProperty("--rot", `${Math.random() * 80}deg`);
            petal.style.animationDelay = `${Math.random() * 9}s`;
            fragPetals.appendChild(petal);
        }

        starsRoot.appendChild(fragStars);
        petalsRoot.appendChild(fragPetals);
    }

    function renderQuote(direction) {
        const q = quotes[index];
        if (!q) return;

        const applyContent = () => {
            const title = (q.title || "").trim();
            const author = (q.author || "").trim();
            const content = (q.content || "").trim();
            const mm = looksMyanmar(content) || looksMyanmar(title);
            const short = content.length > 0 && content.length < 48 && content.split("\n").length <= 2;

            if (title) {
                quoteTitle.hidden = false;
                quoteTitle.textContent = title;
            } else {
                quoteTitle.hidden = true;
                quoteTitle.textContent = "";
            }

            quoteBody.textContent = content;
            quoteBody.classList.toggle("is-mm", mm);
            quoteBody.classList.toggle("is-short", short);

            if (author) {
                quoteAuthor.hidden = false;
                quoteAuthor.textContent = `— ${author}`;
            } else {
                quoteAuthor.hidden = true;
                quoteAuthor.textContent = "";
            }

            pageCount.textContent = `${index + 1} / ${quotes.length}`;
            const pct = quotes.length <= 1 ? 100 : ((index + 1) / quotes.length) * 100;
            progressFill.style.width = `${pct}%`;

            prevBtn.disabled = index <= 0;
            nextBtn.disabled = index >= quotes.length - 1;

            writeState({ open: true, index });
        };

        if (!direction || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            quoteCard.classList.remove(
                "is-exit-next",
                "is-exit-prev",
                "is-enter-next",
                "is-enter-prev"
            );
            applyContent();
            return;
        }

        animating = true;
        const exitClass = direction === "next" ? "is-exit-next" : "is-exit-prev";
        const enterClass = direction === "next" ? "is-enter-next" : "is-enter-prev";

        quoteCard.classList.remove("is-enter-next", "is-enter-prev");
        quoteCard.classList.add(exitClass);

        window.setTimeout(() => {
            applyContent();
            quoteCard.classList.remove(exitClass);
            // force reflow so enter animation restarts
            void quoteCard.offsetWidth;
            quoteCard.classList.add(enterClass);
            window.setTimeout(() => {
                quoteCard.classList.remove(enterClass);
                animating = false;
            }, 480);
        }, 220);
    }

    function goTo(nextIndex, direction) {
        if (animating || !quotes.length) return;
        if (nextIndex < 0 || nextIndex >= quotes.length) return;
        if (nextIndex === index && direction) return;
        index = nextIndex;
        renderQuote(direction);
        hideHintSoon();
    }

    function next() {
        goTo(index + 1, "next");
    }

    function prev() {
        goTo(index - 1, "prev");
    }

    function openReader() {
        cover.classList.add("is-leaving");
        window.setTimeout(() => {
            cover.classList.add("is-hidden");
            cover.setAttribute("hidden", "");
            cover.classList.remove("is-leaving");

            reader.hidden = false;
            reader.classList.remove("is-hidden");
            reader.classList.add("is-entering");
            renderQuote(null);
            writeState({ open: true, index });
            hideHintSoon(4200);
        }, 380);
    }

    function showCover() {
        reader.classList.add("is-hidden");
        reader.hidden = true;
        cover.hidden = false;
        cover.classList.remove("is-hidden", "is-leaving");
        writeState({ open: false, index });
    }

    function hideHintSoon(delay) {
        if (!swipeHint) return;
        window.clearTimeout(hintTimer);
        hintTimer = window.setTimeout(() => {
            swipeHint.classList.add("is-gone");
        }, delay || 2800);
    }

    function bindSwipe(el) {
        let startX = 0;
        let startY = 0;
        let tracking = false;

        el.addEventListener(
            "touchstart",
            (e) => {
                if (!e.touches || e.touches.length !== 1) return;
                tracking = true;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            },
            { passive: true }
        );

        el.addEventListener(
            "touchend",
            (e) => {
                if (!tracking) return;
                tracking = false;
                const t = e.changedTouches && e.changedTouches[0];
                if (!t) return;
                const dx = t.clientX - startX;
                const dy = t.clientY - startY;
                if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
                if (dx < 0) next();
                else prev();
            },
            { passive: true }
        );
    }

    async function loadQuotes() {
        const res = await fetch(QUOTES_URL, { cache: "no-cache" });
        if (!res.ok) throw new Error(`Could not load quotes (${res.status})`);
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) throw new Error("No quotes found");
        return data.filter((q) => q && typeof q.content === "string" && q.content.trim());
    }

    function bindEvents() {
        enterBtn.addEventListener("click", openReader);
        backBtn.addEventListener("click", showCover);
        prevBtn.addEventListener("click", prev);
        nextBtn.addEventListener("click", next);

        document.addEventListener("keydown", (e) => {
            if (reader.hidden) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openReader();
                }
                return;
            }
            if (e.key === "ArrowRight" || e.key === " ") {
                e.preventDefault();
                next();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                prev();
            } else if (e.key === "Escape") {
                showCover();
            }
        });

        bindSwipe(quoteStage);
    }

    async function init() {
        spawnAtmosphere();
        bindEvents();

        try {
            quotes = await loadQuotes();
        } catch (err) {
            quoteBody.textContent = "Could not open the little book… try refreshing.";
            console.error(err);
            return;
        }

        const saved = readState();
        if (saved && typeof saved.index === "number") {
            index = Math.min(Math.max(0, saved.index), quotes.length - 1);
        }

        if (saved && saved.open) {
            cover.classList.add("is-hidden");
            cover.setAttribute("hidden", "");
            reader.hidden = false;
            reader.classList.remove("is-hidden");
            renderQuote(null);
            swipeHint.classList.add("is-gone");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
