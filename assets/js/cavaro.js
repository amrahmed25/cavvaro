/* ==========================================================================
   CAVARO — behaviour layer (single continuous page)
   --------------------------------------------------------------------------
   Connects the existing Stitch screens, now living in one document: the age
   verification entry overlay, scroll navigation with a subtle active state,
   the collection filters, the product links and the shopping bag drawer
   (add / remove / quantity / subtotal). Nothing here changes the design — it
   only makes the elements that are already drawn actually work.
   ========================================================================== */
(function () {
	"use strict";

	var AGE_KEY = "cavaro:age-verified:v2";
	var BAG_KEY = "cavaro:bag";
	var SEED_KEY = "cavaro:bag-seeded";

	var NAV_HEIGHT = 80; /* the height of the fixed bar drawn in the design */
	var ACTIVE_CLASSES = ["text-primary", "border-b", "border-secondary"];
	var IDLE_CLASS = "text-on-surface-variant";

	/* --- storage with an in-memory fallback (file:// or blocked storage) ---- */
	var memory = {};
	var store = {
		get: function (key) {
			try {
				var v = window.localStorage.getItem(key);
				return v === null ? (key in memory ? memory[key] : null) : v;
			} catch (e) {
				return key in memory ? memory[key] : null;
			}
		},
		set: function (key, value) {
			memory[key] = value;
			try {
				window.localStorage.setItem(key, value);
			} catch (e) {}
		},
		remove: function (key) {
			delete memory[key];
			try {
				window.localStorage.removeItem(key);
			} catch (e) {}
		}
	};

	function isVerified() {
		return store.get(AGE_KEY) === "1";
	}

	function reducedMotion() {
		try {
			return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		} catch (e) {
			return false;
		}
	}

	/* --- catalog ----------------------------------------------------------- */
	var CATALOG = window.CAVARO_CATALOG || {};
	var SEED = window.CAVARO_BAG_SEED || [];

	function money(value) {
		return "$" + Number(value).toFixed(2);
	}

	/* --- bag state --------------------------------------------------------- */
	function readBag() {
		var raw = store.get(BAG_KEY);
		var items = [];
		if (raw) {
			try {
				var parsed = JSON.parse(raw);
				if (parsed && parsed.length) items = parsed;
			} catch (e) {
				items = [];
			}
		} else if (store.get(SEED_KEY) !== "1") {
			/* First visit shows the bag exactly as it appears in the design. */
			items = SEED.map(function (id) {
				return { id: id, qty: 1 };
			});
			store.set(SEED_KEY, "1");
			store.set(BAG_KEY, JSON.stringify(items));
		}
		return items.filter(function (line) {
			return line && CATALOG[line.id];
		});
	}

	function writeBag(items) {
		store.set(SEED_KEY, "1");
		store.set(BAG_KEY, JSON.stringify(items));
	}

	function addToBag(id) {
		if (!CATALOG[id]) return;
		var items = readBag();
		var found = false;
		for (var i = 0; i < items.length; i++) {
			if (items[i].id === id) {
				items[i].qty = Math.min(99, (items[i].qty || 1) + 1);
				found = true;
			}
		}
		if (!found) items.push({ id: id, qty: 1 });
		writeBag(items);
		renderBag();
	}

	function setQty(id, qty) {
		var items = readBag()
			.map(function (line) {
				if (line.id !== id) return line;
				return { id: id, qty: Math.max(0, Math.min(99, qty)) };
			})
			.filter(function (line) {
				return line.qty > 0;
			});
		writeBag(items);
		renderBag();
	}

	function removeFromBag(id) {
		writeBag(
			readBag().filter(function (line) {
				return line.id !== id;
			})
		);
		renderBag();
	}

	/* --- transient button label (used for feedback, no design change) ------ */
	function flash(el, label, ms) {
		if (!el || el.dataset.flashing === "1") return;
		var original = el.innerHTML;
		el.dataset.flashing = "1";
		el.textContent = label;
		window.setTimeout(function () {
			el.innerHTML = original;
			delete el.dataset.flashing;
		}, ms || 1400);
	}

	/* --- shopping bag rendering ------------------------------------------- */
	function renderBag() {
		var host = document.querySelector("[data-bag-items]");
		var template = document.querySelector("[data-bag-item-template]");
		var subtotalEl = document.querySelector("[data-bag-subtotal]");
		if (!host || !template) return;

		var items = readBag();
		var total = 0;

		Array.prototype.slice
			.call(host.querySelectorAll("[data-bag-line], .bag-empty"))
			.forEach(function (node) {
				node.parentNode.removeChild(node);
			});

		if (!items.length) {
			var empty = document.createElement("div");
			empty.className = "bag-empty";
			empty.innerHTML =
				'<p class="bag-empty__title">Your bag is empty</p>' +
				'<p class="bag-empty__note">Selected vitolas will appear here.</p>';
			host.appendChild(empty);
			if (subtotalEl) subtotalEl.textContent = money(0);
			return;
		}

		items.forEach(function (line) {
			var product = CATALOG[line.id];
			var qty = Math.max(1, line.qty || 1);
			total += product.price * qty;

			var node = template.content.firstElementChild.cloneNode(true);
			node.setAttribute("data-bag-line", line.id);

			var image = node.querySelector("[data-item-image]");
			if (image) {
				if (image.tagName === "IMG") image.src = product.image;
				else image.style.backgroundImage = 'url("' + product.image + '")';
			}

			var title = node.querySelector("[data-item-title]");
			if (title) title.textContent = product.name;

			var meta1 = node.querySelector("[data-item-meta-1]");
			var meta2 = node.querySelector("[data-item-meta-2]");
			if (meta1) meta1.textContent = product.meta1 || "";
			if (meta2) {
				if (product.meta2) meta2.textContent = product.meta2;
				else meta2.parentNode.removeChild(meta2);
			}

			var price = node.querySelector("[data-item-price]");
			if (price) price.textContent = money(product.price * qty);

			/* Quantity stepper, written in the same visual language as the
			   surrounding item details. */
			var anchor = (product.meta2 && meta2) || meta1;
			if (anchor && anchor.parentNode) {
				var qtyRow = document.createElement("div");
				qtyRow.className = "bag-qty";
				qtyRow.innerHTML =
					'<span class="bag-qty__label">QTY</span>' +
					'<button type="button" class="bag-qty__btn" data-qty-down aria-label="Decrease quantity">\u2212</button>' +
					'<span class="bag-qty__value" data-qty-value>' +
					qty +
					"</span>" +
					'<button type="button" class="bag-qty__btn" data-qty-up aria-label="Increase quantity">+</button>';
				anchor.parentNode.insertBefore(qtyRow, anchor.nextSibling);
			}

			host.appendChild(node);
		});

		if (subtotalEl) subtotalEl.textContent = money(total);
	}

	/* --- Material Symbols fallback (keeps the icons intact offline) -------- */
	var ICONS = {
		shopping_bag:
			'<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v120h-80v-120H400v120h-80v-120h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z"/></svg>',
		close:
			'<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>',
		menu:
			'<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>'
	};

	/* FontFaceSet.check() reports success for unknown families, so the icon font
	   is detected by measuring a ligature instead: when the font is active the
	   whole word collapses into one glyph. */
	function iconsAvailable() {
		try {
			var canvas = document.createElement("canvas");
			var ctx = canvas.getContext && canvas.getContext("2d");
			if (!ctx) return true;
			ctx.font = '24px "Material Symbols Outlined", monospace';
			var withFont = ctx.measureText("shopping_bag").width;
			ctx.font = "24px monospace";
			var withoutFont = ctx.measureText("shopping_bag").width;
			return Math.abs(withFont - withoutFont) > 1;
		} catch (e) {
			return true;
		}
	}

	function applyIconFallback() {
		if (iconsAvailable()) return;
		Array.prototype.slice
			.call(document.querySelectorAll(".material-symbols-outlined"))
			.forEach(function (el) {
				if (el.hasAttribute("data-icon-svg")) return;
				var name = (el.textContent || "").trim();
				if (!ICONS[name]) return;
				el.setAttribute("data-icon-svg", name);
				el.innerHTML = ICONS[name];
			});
	}

	/* --- mobile menu: stacks the very same nav links under the bar --------- */
	function ensureNavPanel() {
		var header = document.querySelector("nav") || document.querySelector("header");
		if (!header || header.querySelector(".nav-panel")) return;
		var sources = document.querySelectorAll("nav [data-nav-target]");
		if (!sources.length) sources = document.querySelectorAll("[data-nav-links] a");
		if (!sources.length) return;
		var panel = document.createElement("div");
		panel.className = "nav-panel";
		Array.prototype.slice.call(sources).forEach(function (link) {
			panel.appendChild(link.cloneNode(true));
		});
		header.appendChild(panel);
	}

	function closeNav() {
		document.body.classList.remove("nav-open");
	}

	/* --- collection filters ----------------------------------------------- */
	function applyFilter(scope, value) {
		var active = scope.getAttribute("data-filter-active-class") || "";
		var idle = scope.getAttribute("data-filter-idle-class") || "";
		Array.prototype.slice
			.call(scope.querySelectorAll("[data-filter]"))
			.forEach(function (button) {
				var on = button.getAttribute("data-filter") === value;
				if (active && idle) button.className = on ? active : idle;
			});
		Array.prototype.slice
			.call(document.querySelectorAll("[data-product-card]"))
			.forEach(function (card) {
				var show =
					value === "all" || card.getAttribute("data-category") === value;
				card.style.display = show ? "" : "none";
			});
	}

	/* --- scroll navigation ------------------------------------------------ */
	function documentTop(el) {
		var rect = el.getBoundingClientRect();
		var scrolled = window.pageYOffset || document.documentElement.scrollTop || 0;
		var top = rect.top + scrolled;
		if (el.id !== "hero") top -= NAV_HEIGHT - 1;
		return Math.max(0, Math.round(top));
	}

	function scrollToHash(hash, instant) {
		if (!hash || hash.length < 2) return false;
		var target = null;
		try {
			target = document.querySelector(hash);
		} catch (e) {
			return false;
		}
		if (!target) return false;
		closeNav();
		var top = documentTop(target);
		try {
			window.scrollTo({
				top: top,
				behavior: instant || reducedMotion() ? "auto" : "smooth"
			});
		} catch (e) {
			window.scrollTo(0, top);
		}
		setActive(hash);
		return true;
	}

	/* The active state uses the treatment the design already draws on the
	   current page: cream text with a 1px gold rule underneath. */
	function setActive(hash) {
		Array.prototype.slice
			.call(document.querySelectorAll("[data-nav-target]"))
			.forEach(function (link) {
				var on = link.getAttribute("data-nav-target") === hash;
				ACTIVE_CLASSES.forEach(function (name) {
					if (on) link.classList.add(name);
					else link.classList.remove(name);
				});
				if (on) link.classList.remove(IDLE_CLASS);
				else link.classList.add(IDLE_CLASS);
			});
	}

	function setupScrollSpy() {
		var sections = Array.prototype.slice.call(
			document.querySelectorAll("[data-section]")
		);
		if (!sections.length) return;

		/* Blocks without a nav item of their own (the featured cigar and its
		   detail) keep the previous nav item lit. */
		var linked = {};
		Array.prototype.slice
			.call(document.querySelectorAll("[data-nav-target]"))
			.forEach(function (link) {
				linked[link.getAttribute("data-nav-target")] = true;
			});
		var effective = [];
		var carry = "";
		sections.forEach(function (section) {
			var hash = "#" + section.id;
			if (linked[hash]) carry = hash;
			effective.push(carry);
		});

		var ticking = false;

		function update() {
			ticking = false;
			var scrolled = window.pageYOffset || document.documentElement.scrollTop || 0;
			var line = scrolled + NAV_HEIGHT + 48;
			var current = "";
			sections.forEach(function (section, index) {
				var top = section.getBoundingClientRect().top + scrolled;
				if (top <= line) current = effective[index];
			});
			var docHeight = Math.max(
				document.body.scrollHeight,
				document.documentElement.scrollHeight
			);
			if (scrolled + window.innerHeight >= docHeight - 4) {
				current = effective[effective.length - 1];
			}
			setActive(current);
		}

		function onScroll() {
			if (ticking) return;
			ticking = true;
			window.requestAnimationFrame(update);
		}

		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		update();
	}

	/* --- age verification: the entry screen of the same page --------------- */
	var gate = null;

	function hideGate(animate) {
		if (!gate) return;
		document.body.classList.remove("gate-open");
		if (!animate || reducedMotion()) {
			gate.classList.add("is-hidden");
			return;
		}
		gate.classList.add("is-closing");
		window.setTimeout(function () {
			gate.classList.add("is-hidden");
			gate.classList.remove("is-closing");
		}, 700);
	}

	function showGate() {
		if (!gate) return;
		document.documentElement.classList.remove("gate-verified");
		gate.classList.remove("is-hidden");
		gate.classList.remove("is-closing");
		document.body.classList.add("gate-open");
		window.scrollTo(0, 0);
	}

	function unlockIfGateClosed() {
		var g = document.querySelector("[data-gate]");
		var down = !g || g.classList.contains("is-hidden") ||
			window.getComputedStyle(g).display === "none";
		if (!down) return;
		document.body.classList.remove("gate-open");
		if (document.body.style.overflow === "hidden") document.body.style.overflow = "";
	}

	function setupGate() {
		gate = document.querySelector("[data-gate]");
		if (!gate) return;

		if (isVerified()) hideGate(false);
		else showGate();

		var enter = gate.querySelector("[data-age-enter]");
		var exit = gate.querySelector("[data-age-exit]");

		if (enter) {
			enter.addEventListener("click", function (event) {
				event.preventDefault();
				store.set(AGE_KEY, "1");
				window.scrollTo(0, 0);
				hideGate(true);
			});
		}
		if (exit) {
			exit.addEventListener("click", function (event) {
				event.preventDefault();
				store.remove(AGE_KEY);
				try {
					window.open("", "_self");
					window.close();
				} catch (e) {}
				showGate();
			});
		}

		/* The page must never stay locked while the gate is down. */
		window.setTimeout(unlockIfGateClosed, 1200);
		window.addEventListener("load", unlockIfGateClosed);
	}

	/* --- shopping bag: the same drawer, now an overlay of this page -------- */
	var bagRoot = null;

	function openBag() {
		if (!bagRoot) return;
		renderBag();
		closeNav();
		bagRoot.classList.add("is-open");
		document.body.classList.add("bag-open");
		/* replays the design's own slide-in each time the drawer opens */
		var panel = bagRoot.querySelector(".slide-in-right");
		if (panel && !reducedMotion()) {
			panel.style.animation = "none";
			void panel.offsetWidth;
			panel.style.animation = "";
		}
	}

	function closeBag() {
		if (!bagRoot) return;
		bagRoot.classList.remove("is-open");
		document.body.classList.remove("bag-open");
	}

	/* --- wiring ------------------------------------------------------------ */
	function ready() {
		applyIconFallback();
		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(applyIconFallback);
		}
		window.setTimeout(applyIconFallback, 1200);

		bagRoot = document.querySelector("[data-bag-root]");
		renderBag();
		setupGate();
		setupScrollSpy();

		/* Mobile navigation reveals the same links the desktop bar uses */
		var toggle = document.querySelector("[data-nav-toggle]");
		if (toggle) {
			toggle.addEventListener("click", function (event) {
				event.preventDefault();
				ensureNavPanel();
				document.body.classList.toggle("nav-open");
			});
		}

		/* Collection filters */
		var filterScope = document.querySelector("[data-filter-scope]");
		if (filterScope) {
			Array.prototype.slice
				.call(filterScope.querySelectorAll("[data-filter]"))
				.forEach(function (button) {
					button.addEventListener("click", function (event) {
						event.preventDefault();
						applyFilter(filterScope, button.getAttribute("data-filter"));
					});
				});
		}

		/* Contact form */
		var form = document.querySelector("[data-contact-form]");
		var submitButton = document.querySelector("[data-contact-submit]");
		function sendInquiry(event) {
			event.preventDefault();
			flash(submitButton || (form && form.querySelector("button")), "INQUIRY SENT", 2200);
			if (form && form.reset) form.reset();
		}
		if (form && form.tagName === "FORM") {
			form.addEventListener("submit", sendInquiry);
		}
		if (submitButton) {
			submitButton.addEventListener("click", sendInquiry);
		}

		/* One delegated handler for every control drawn in the design */
		var note = document.querySelector("[data-bag-note]");
		var noteText = note ? note.textContent : "";
		document.addEventListener("click", function (event) {
			var target = event.target;
			if (!target || !target.closest) return;

			if (target.closest("[data-bag-open]")) {
				event.preventDefault();
				openBag();
				return;
			}

			if (target.closest("[data-bag-close]")) {
				event.preventDefault();
				closeBag();
				return;
			}

			if (target.closest("[data-bag-continue]")) {
				event.preventDefault();
				closeBag();
				scrollToHash("#collection");
				return;
			}

			if (target.closest("[data-bag-checkout]")) {
				event.preventDefault();
				if (note) {
					note.textContent = readBag().length
						? "Your selection is held. A Cavaro concierge completes the checkout."
						: "Your bag is empty.";
					window.setTimeout(function () {
						note.textContent = noteText;
					}, 4500);
				}
				return;
			}

			var remove = target.closest("[data-item-remove]");
			if (remove) {
				event.preventDefault();
				var lineToRemove = remove.closest("[data-bag-line]");
				if (lineToRemove) removeFromBag(lineToRemove.getAttribute("data-bag-line"));
				return;
			}

			var down = target.closest("[data-qty-down]");
			var up = target.closest("[data-qty-up]");
			if (down || up) {
				event.preventDefault();
				var line = (down || up).closest("[data-bag-line]");
				if (!line) return;
				var id = line.getAttribute("data-bag-line");
				var current = 1;
				readBag().forEach(function (item) {
					if (item.id === id) current = item.qty || 1;
				});
				setQty(id, current + (up ? 1 : -1));
				return;
			}

			var add = target.closest("[data-add-to-bag]");
			if (add) {
				event.preventDefault();
				addToBag(add.getAttribute("data-add-to-bag"));
				flash(add, "ADDED TO HUMIDOR");
				return;
			}

			if (target.closest("[data-inert]")) {
				event.preventDefault();
				return;
			}

			/* Scroll navigation: nav links, buttons and product cards */
			var jump = target.closest("[data-href]");
			if (jump) {
				var value = jump.getAttribute("data-href");
				if (value && value.charAt(0) === "#") {
					event.preventDefault();
					scrollToHash(value);
					return;
				}
			}

			var anchor = target.closest('a[href^="#"]');
			if (anchor) {
				var hash = anchor.getAttribute("href");
				event.preventDefault();
				if (hash && hash.length > 1) scrollToHash(hash);
			}
		});

		/* Keyboard support for the elements that are not native links */
		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape") {
				closeBag();
				closeNav();
				return;
			}
			if (event.key !== "Enter" && event.key !== " ") return;
			var target = document.activeElement;
			if (!target || !target.closest) return;
			var jump = target.closest("[data-href]");
			if (jump && jump.tagName !== "A" && jump.tagName !== "BUTTON") {
				var value = jump.getAttribute("data-href");
				if (value && value.charAt(0) === "#") {
					event.preventDefault();
					scrollToHash(value);
				}
			}
		});

		/* A deep link such as index.html#craft still lands on the right block */
		if (location.hash && location.hash.length > 1 && isVerified()) {
			window.setTimeout(function () {
				scrollToHash(location.hash, true);
			}, 60);
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", ready);
	} else {
		ready();
	}
})();
