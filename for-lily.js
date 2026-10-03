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
    const swipeHint = document.getElementById("swipe-hint");
    const starsRoot = document.getElementById("sky-stars");
    const petalsRoot = document.getElementById("sky-petals");
    const quoteStage = document.getElementById("quote-stage");
    const scrubber = document.getElementById("quote-scrubber");
    const scrubberTrack = document.getElementById("scrubber-track");
    const scrubberChip = document.getElementById("scrubber-chip");
    const scrubberChipNum = document.getElementById("scrubber-chip-num");
    const scrubberChipPeek = document.getElementById("scrubber-chip-peek");
    const scrubberToggle = document.getElementById("scrubber-toggle");

    let quotes = [];
    let index = 0;
    let animating = false;
    let hintTimer = null;
    let scrubberOpen = false;

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

            prevBtn.disabled = index <= 0;
            nextBtn.disabled = index >= quotes.length - 1;

            syncScrubberActive(index);
            if (scrubberOpen) showScrubberChip(index);
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

    function quotePeek(quote) {
        if (!quote) return "";
        const title = (quote.title || "").trim();
        if (title) return title;
        const content = (quote.content || "").trim();
        const first = content.split("\n")[0] || "";
        if (first.length > 32) return first.slice(0, 32) + "…";
        return first;
    }

    function buildScrubber(total) {
        if (!scrubberTrack) return;
        scrubberTrack.innerHTML = "";
        const frag = document.createDocumentFragment();
        for (let i = 0; i < total; i += 1) {
            const tick = document.createElement("button");
            tick.type = "button";
            tick.className = "quote-scrubber__tick";
            tick.setAttribute("data-index", String(i));
            tick.setAttribute("role", "option");
            tick.setAttribute("aria-label", "Quote " + (i + 1));
            tick.style.setProperty("--tick-delay", Math.min(i * 12, 280) + "ms");
            frag.appendChild(tick);
        }
        scrubberTrack.appendChild(frag);
        layoutScrubberArc();
        syncScrubberActive(index);
    }

    function layoutScrubberArc() {
        if (!scrubberTrack) return;
        const ticks = scrubberTrack.querySelectorAll(".quote-scrubber__tick");
        const n = ticks.length;
        if (!n) return;

        const w = scrubberTrack.clientWidth || 1;
        const h = scrubberTrack.clientHeight || 1;
        const cx = w / 2;
        const cy = h * 0.92;
        const radius = Math.min(w * 0.46, h * 0.86);

        for (let i = 0; i < n; i += 1) {
            const t = n === 1 ? 0.5 : i / (n - 1);
            const theta = Math.PI - t * Math.PI;
            const x = cx + radius * Math.cos(theta);
            const y = cy - radius * Math.sin(theta);
            ticks[i].style.left = x + "px";
            ticks[i].style.top = y + "px";
        }
    }

    function syncScrubberActive(activeIndex) {
        if (!scrubberTrack) return;
        const total = quotes.length;
        const clamped = Math.max(0, Math.min(Math.max(total - 1, 0), activeIndex));
        const ticks = scrubberTrack.querySelectorAll(".quote-scrubber__tick");
        for (let i = 0; i < ticks.length; i += 1) {
            const on = i === clamped;
            ticks[i].classList.toggle("is-active", on);
            ticks[i].setAttribute("aria-selected", on ? "true" : "false");
        }
    }

    function showScrubberChip(activeIndex) {
        if (!scrubberChip || !scrubberChipNum || !scrubberChipPeek) return;
        const total = Math.max(quotes.length, 1);
        const clamped = Math.max(0, Math.min(total - 1, activeIndex));
        scrubberChipNum.textContent = clamped + 1 + " / " + total;
        scrubberChipPeek.textContent = quotePeek(quotes[clamped]);
        scrubberChip.removeAttribute("hidden");
        scrubberChip.classList.add("is-visible");
    }

    function hideScrubberChip() {
        if (!scrubberChip) return;
        scrubberChip.classList.remove("is-visible");
        scrubberChip.setAttribute("hidden", "");
    }

    function setScrubberOpen(open) {
        if (!scrubber || !scrubberToggle) return;
        scrubberOpen = Boolean(open);
        scrubber.classList.toggle("is-open", scrubberOpen);
        scrubberToggle.setAttribute("aria-expanded", scrubberOpen ? "true" : "false");
        scrubberToggle.setAttribute(
            "aria-label",
            scrubberOpen ? "Close quote index" : "Open quote index"
        );

        if (scrubberOpen) {
            scrubber.removeAttribute("hidden");
            layoutScrubberArc();
            syncScrubberActive(index);
            showScrubberChip(index);
        } else {
            hideScrubberChip();
            scrubber.setAttribute("hidden", "");
        }
    }

    function goTo(nextIndex, direction, options) {
        options = options || {};
        if (!quotes.length) return;
        if (nextIndex < 0 || nextIndex >= quotes.length) return;
        if (nextIndex === index && direction && !options.force) return;

        if (options.instant) {
            animating = false;
            index = nextIndex;
            renderQuote(null);
            hideHintSoon();
            return;
        }

        if (animating) return;
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

    function bindScrubber() {
        if (!scrubberToggle || !scrubber || !scrubberTrack || scrubberToggle.dataset.bound === "1") {
            return;
        }
        scrubberToggle.dataset.bound = "1";

        scrubberToggle.addEventListener("click", function (e) {
            e.stopPropagation();
            if (!quotes.length) return;
            setScrubberOpen(!scrubberOpen);
        });

        scrubberTrack.addEventListener("click", function (e) {
            const tick = e.target.closest(".quote-scrubber__tick");
            if (!tick) return;
            const idx = parseInt(tick.getAttribute("data-index"), 10);
            if (Number.isNaN(idx)) return;
            const direction = idx > index ? "next" : idx < index ? "prev" : null;
            goTo(idx, direction, { instant: Math.abs(idx - index) > 1, force: true });
            showScrubberChip(idx);
            setScrubberOpen(false);
        });

        scrubberTrack.addEventListener("pointerover", function (e) {
            const tick = e.target.closest(".quote-scrubber__tick");
            if (!tick || !scrubberOpen) return;
            const idx = parseInt(tick.getAttribute("data-index"), 10);
            if (!Number.isNaN(idx)) showScrubberChip(idx);
        });

        document.addEventListener("click", function (e) {
            if (!scrubberOpen) return;
            if (e.target.closest("#quote-scrubber") || e.target.closest("#scrubber-toggle")) return;
            setScrubberOpen(false);
        });

        window.addEventListener("resize", function () {
            if (scrubberOpen) layoutScrubberArc();
        });
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
        setScrubberOpen(false);
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
        bindScrubber();

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
                if (scrubberOpen) {
                    e.preventDefault();
                    setScrubberOpen(false);
                    return;
                }
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

        buildScrubber(quotes.length);

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
        } else {
            syncScrubberActive(index);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
