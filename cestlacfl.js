// ==UserScript==
// @name         FTPlace - 42LSAV2
// @namespace    https://github.com/gabrielle-pch/CFLSCRIPT
// @version      0.2
// @description  Letz show which is the best 42 student association.
// @author       gpochon
// @match        https://ftplace.42lausanne.ch/*
// @icon         https://raw.githubusercontent.com/gabrielle-pch/CFLSCRIPT/main/icon.jpg // Use raw for icon too
// @grant        GM_info
// @connect      raw.githubusercontent.com
// @downloadURL  https://raw.githubusercontent.com/gabrielle-pch/CFLSCRIPT/main/cestlacfl.js // Assuming this is the final file name
// @updateURL    https://raw.githubusercontent.com/gabrielle-pch/CFLSCRIPT/main/cestlacfl.js
// ==/UserScript==

(async function () {
    'use strict';

    const DEBUG = false;

    // These variables will be assigned when the canvas/overlay are found/created
    let canvas = null;
    let overlay = null;
    let uiControls = null;

    // --- Constants and Options ---
    const UPDATE_URL = GM_info.script.updateURL;
    const OVERLAY_URL_BASE = "https://raw.githubusercontent.com/gabrielle-pch/CFLSCRIPT/refs/heads/main/overlay-export.png";
    const VERSION_URL = "https://raw.githubusercontent.com/gabrielle-pch/CFLSCRIPT/main/version.json";
    const FTPLACE_URL = "https://ftplace.42lausanne.ch/";

    const allowedLangs = ['fr', 'en'];
    const defaultOpts = {
        OVERLAY_STATE: true,
        OVERLAY_OPACITY: 0.3,
        ENABLE_AUTOREFRESH: false,
        AUTOREFRESH_DELAY: 5000,
        ENABLE_IMGNOCACHE: true,
        VERSION: GM_info.script.version,
        LANG: allowedLangs[0]
    };

    let opts = defaultOpts;
    try {
        const storedOpts = localStorage.getItem("42lsa_opts");
        if (storedOpts) {
            opts = JSON.parse(storedOpts);
        }
    } catch (e) {
        console.warn("42LSA: Error parsing stored options, using defaults.", e);
        opts = defaultOpts;
    }

    const saveOpts = () => {
        try {
            localStorage.setItem("42lsa_opts", JSON.stringify(opts));
        } catch (e) {
            console.error("42LSA: Error saving options to localStorage.", e);
        }
    };

    const refreshOpts = () => {
        if (GM_info.script.version !== opts.VERSION) {
            log("Opts version mismatch, refreshing options.");
            opts = {
                ...defaultOpts, // Start with a fresh default set
                ...opts,        // Overlay stored options
                VERSION: GM_info.script.version // Update to current script version
            };
            // Clean up any old options not in current defaults
            for (let optKey in opts) {
                if (!defaultOpts.hasOwnProperty(optKey)) {
                    delete opts[optKey];
                }
            }
        }
        saveOpts();
    };

    const LANGS = {
        fr: {
            update_available: "Mise à jour disponible v{{0}} > v{{1}} ! Cliquez ici pour l'installer",
            update_reload: "La page va se recharger dans 5s...",
            show: "Afficher",
            hide: "Cacher",
            enable: "Activer",
            disable: "Désactiver",
            btn_update_script: "M.À.J Script",
            btn_toggle_overlay: "{{0}} Overlay",
            btn_refresh_overlay: "Rafraîchir Overlay",
            btn_autorefresh_overlay: "{{0}} Auto-Refresh ({{1}}s)",
            btn_toggle_cache: "{{0}} Cache Overlay",
            overlay_opacity: "Opacité Overlay",
            by_shadow_team: "42LSA Overlay v{{0}} par staverni"
        },
        en: {
            update_available: "Update available v{{0}} > v{{1}} ! Click here to install",
            update_reload: "Page will reload in 5s...",
            show: "Show",
            hide: "Hide",
            enable: "Enable",
            disable: "Disable",
            btn_update_script: "Update Script",
            btn_toggle_overlay: "{{0}} Overlay",
            btn_refresh_overlay: "Refresh Overlay",
            btn_autorefresh_overlay: "{{0}} Auto-Refresh ({{1}}s)",
            btn_toggle_cache: "{{0}} Overlay Cache",
            overlay_opacity: "Overlay Opacity",
            by_shadow_team: "42LSA Overlay v{{0}} by staverni"
        },
    };

    const f = (key, ...vars) => {
        let string = LANGS[opts.LANG]?.[key] || `MISSING_KEY: ${key}`; // Fallback for missing keys
        if (vars && vars.length > 0) {
            vars.forEach((val, i) => {
                string = string.replace(`{{${i}}}`, val);
            });
        }
        return string;
    };

    const log = (...args) => DEBUG ? console.log("42LSA Script:", ...args) : null;

    const openLink = (link, autoclose = false) => { // Renamed to avoid conflict with window.open
        let tab = window.open(link, "_blank");
        if (tab) {
            tab.focus();
            if (autoclose) setTimeout(() => tab.close(), 25);
        } else {
            log("Popup blocked or error opening link:", link);
        }
    };

    // --- Version Checking ---
    const versionState = (a, b) => {
        if (!a || !b) return 0; // Handle undefined versions
        let x = a.split(".").map(e => parseInt(e, 10));
        let y = b.split(".").map(e => parseInt(e, 10));
        let z = "";

        for (let i = 0; i < Math.max(x.length, y.length); i++) {
            const xi = x[i] || 0; // Default to 0 if part is missing
            const yi = y[i] || 0;
            if (xi === yi) z += "e";
            else if (xi > yi) z += "m";
            else z += "l";
        }
        if (!z.match(/[l|m]/g)) return 0; // Equal
        return (z.replace(/e/g, "")[0] === "m") ? 1 : -1; // 1 if a > b, -1 if a < b
    };

    const showUpdateNotification = (newVersion) => { // Renamed for clarity
        if (document.getElementById("42lsa-update-notification")) return;

        const updateDiv = document.createElement("div");
        Object.assign(updateDiv.style, {
            position: "fixed", background: "white", right: "10px", padding: "0 10px",
            textAlign: "center", color: "red", top: "65px", zIndex: "10001", // Higher z-index
            height: "40px", lineHeight: "40px", border: "1px solid rgba(0,0,0,0.3)",
            borderRadius: "10px", fontSize: "1.3em", cursor: "pointer"
        });
        updateDiv.id = "42lsa-update-notification";
        let messageNode = document.createTextNode(f("update_available", GM_info.script.version, newVersion));
        updateDiv.appendChild(messageNode);
        document.body.appendChild(updateDiv);

        updateDiv.addEventListener("click", () => {
            messageNode.textContent = f("update_reload");
            openLink(UPDATE_URL); // Use GM_openInTab or window.open
            setTimeout(() => window.location.reload(), 5000);
        });
    };

    const checkVersion = () => {
        setInterval(async () => {
            try {
                const response = await fetch(VERSION_URL);
                if (!response.ok) return console.warn("Couldn't get version.json");
                const {version} = await response.json();

                const needUpdate = versionState(version, GM_info.script.version) === 1;
                if(needUpdate) showUpdateNotification(version);
            } catch (err) {
                console.warn("Couldn't get orders:", err);
            }
        }, 15000)
    };


    // --- Overlay Logic ---
    const overlayURL = () => OVERLAY_URL_BASE + (opts.ENABLE_IMGNOCACHE ? "?t=" + new Date().getTime() : "");
    let autoRefreshTimer = null;

    const updateOverlayStyle = () => {
        if (!canvas || !overlay) return;

        const currentTransform = canvas.style.transform;
        const currentMarginTop = canvas.style.marginTop;
        const currentLeft = canvas.offsetLeft;
        
        Object.assign(overlay.style, {
            position: "absolute",
            top: '0px',
            left: currentLeft + 'px',
            width: '400px',
            height: '400px',
            transform: currentTransform,
            marginTop: currentMarginTop,
            imageRendering: "crisp-edges",
            pointerEvents: "none",
            zIndex: '10',
            opacity: opts.OVERLAY_STATE ? opts.OVERLAY_OPACITY : '0'
        });
    };

    const createOrUpdateOverlay = () => { // Renamed
        if (!canvas) {
            log("Canvas not found in createOrUpdateOverlay!");
            return;
        }
        if (!overlay) {
            overlay = document.createElement("img");
            overlay.id = "ftplace_42lsa_overlay"; // Add an ID for easier debugging
            overlay.alt = "42LSA Overlay";
            overlay.classList.add('canvas_display');
            overlay.addEventListener('error', () => { // Handle image load errors
                log("Error loading overlay image from:", overlay.src);
                overlay.style.border = "2px dashed red"; // Visual cue for error
            });
            overlay.addEventListener('load', () => {
                log("Overlay image loaded successfully.");
                overlay.style.border = ""; // Clear error border
            });
            canvas.parentNode.appendChild(overlay);
            log("Overlay element created and appended.");
        }
        overlay.src = overlayURL(); // Set or update src
        updateOverlayStyle(); // Apply styles
        log("Overlay source updated and styles applied.");
    };

    const startOverlayAutoRefresh = () => {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        if (opts.ENABLE_AUTOREFRESH) {
            autoRefreshTimer = setInterval(() => {
                log("Autorefresh: updating overlay source.");
                if (overlay) overlay.src = overlayURL();
            }, opts.AUTOREFRESH_DELAY);
            log("Overlay auto-refresh started.");
        }
    };

    const stopOverlayAutoRefresh = () => {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
            log("Overlay auto-refresh stopped.");
        }
    };


    // --- UI Logic ---
    const buildUI = () => {
        log("Building UI...");
        if (document.getElementById("42lsa-controls-panel")) {
            log("UI panel already exists.");
            return; // Avoid creating multiple UIs
        }

        const defaultStyle = (el) => Object.assign(el.style, { border: "1px solid rgba(0,0,0,0.3)", backgroundColor: "white", fontSize: "0.9em", color: "black", fontWeight: "bold", padding: "5px 8px", cursor: "pointer" });
        const defaultBtn = (el) => Object.assign(el.style, { borderRadius: "10px", marginBottom: "5px", display: "block", width: "100%" });
        const defaultBlock = (el) => Object.assign(el.style, { padding: "5px", marginBottom: "5px", borderRadius: "10px", border: "1px solid rgba(0,0,0,0.2)", backgroundColor: "rgba(240,240,240,0.9)" });

        uiControls = document.createElement("div");
        uiControls.id = "42lsa-controls-panel";
        Object.assign(uiControls.style, { position: "fixed", left: "10px", top: "10px", width: "160px", zIndex: "10000", fontFamily: "Arial, sans-serif" });

        // Update Script Button
        const updateBtn = document.createElement("button");
        updateBtn.textContent = f("btn_update_script");
        defaultStyle(updateBtn); defaultBtn(updateBtn);
        updateBtn.addEventListener("click", () => openLink(UPDATE_URL));
        uiControls.appendChild(updateBtn);

        // Toggle Overlay Button
        const toggleOverlayBtn = document.createElement("button");
        const updateToggleOverlayBtnText = () => { toggleOverlayBtn.textContent = f("btn_toggle_overlay", opts.OVERLAY_STATE ? f("hide") : f("show")); };
        updateToggleOverlayBtnText();
        defaultStyle(toggleOverlayBtn); defaultBtn(toggleOverlayBtn);
        toggleOverlayBtn.addEventListener("click", () => {
            opts.OVERLAY_STATE = !opts.OVERLAY_STATE;
            saveOpts();
            updateToggleOverlayBtnText();
            updateOverlayStyle(); // Update opacity
        });
        uiControls.appendChild(toggleOverlayBtn);

        // Refresh Overlay Button
        const refreshOverlayBtn = document.createElement("button");
        refreshOverlayBtn.textContent = f("btn_refresh_overlay");
        defaultStyle(refreshOverlayBtn); defaultBtn(refreshOverlayBtn);
        refreshOverlayBtn.addEventListener("click", () => { if (overlay) overlay.src = overlayURL(); });
        uiControls.appendChild(refreshOverlayBtn);

        // Opacity Slider
        const opacityBlock = document.createElement("div");
        defaultBlock(opacityBlock);
        const opacityLabel = document.createElement("label");
        opacityLabel.textContent = f("overlay_opacity") + ": ";
        opacityLabel.style.display = "block";
        opacityLabel.style.marginBottom = "3px";
        const opacitySlider = document.createElement("input");
        opacitySlider.type = "range";
        opacitySlider.min = "0";
        opacitySlider.max = "1";
        opacitySlider.step = "0.05";
        opacitySlider.value = opts.OVERLAY_OPACITY;
        opacitySlider.style.width = "95%";
        opacitySlider.addEventListener("input", (e) => {
            opts.OVERLAY_OPACITY = e.target.value;
            if (opts.OVERLAY_STATE) updateOverlayStyle(); // Only update if overlay is visible
        });
        opacitySlider.addEventListener("change", saveOpts); // Save on release
        opacityBlock.appendChild(opacityLabel);
        opacityBlock.appendChild(opacitySlider);
        uiControls.appendChild(opacityBlock);


        // Auto-Refresh Toggle
        const autoRefreshBtn = document.createElement("button");
        const updateAutoRefreshBtnText = () => { autoRefreshBtn.textContent = f("btn_autorefresh_overlay", opts.ENABLE_AUTOREFRESH ? f("disable") : f("enable"), opts.AUTOREFRESH_DELAY / 1000); };
        updateAutoRefreshBtnText();
        defaultStyle(autoRefreshBtn); defaultBtn(autoRefreshBtn);
        autoRefreshBtn.addEventListener("click", () => {
            opts.ENABLE_AUTOREFRESH = !opts.ENABLE_AUTOREFRESH;
            if (opts.ENABLE_AUTOREFRESH) {
                opts.ENABLE_IMGNOCACHE = true; // Force no-cache if auto-refresh is on
                updateNoCacheBtnText(); // Update dependent button
                startOverlayAutoRefresh();
            } else {
                stopOverlayAutoRefresh();
            }
            saveOpts();
            updateAutoRefreshBtnText();
        });
        uiControls.appendChild(autoRefreshBtn);

        // No Cache Toggle
        const noCacheBtn = document.createElement("button");
        const updateNoCacheBtnText = () => { noCacheBtn.textContent = f("btn_toggle_cache", opts.ENABLE_IMGNOCACHE ? f("disable") : f("enable")); };
        updateNoCacheBtnText();
        defaultStyle(noCacheBtn); defaultBtn(noCacheBtn);
        noCacheBtn.addEventListener("click", () => {
            if (opts.ENABLE_AUTOREFRESH) return; // Don't allow disabling cache if auto-refresh is on
            opts.ENABLE_IMGNOCACHE = !opts.ENABLE_IMGNOCACHE;
            saveOpts();
            updateNoCacheBtnText();
        });
        uiControls.appendChild(noCacheBtn);


        // Language Switcher
        const langBlock = document.createElement("div");
        defaultBlock(langBlock);
        langBlock.style.textAlign = "center";
        allowedLangs.forEach(lang => {
            const langBtn = document.createElement("button");
            langBtn.textContent = lang.toUpperCase();
            defaultStyle(langBtn);
            Object.assign(langBtn.style, { display: "inline-block", width: "auto", marginRight: "5px", padding: "3px 6px" });
            if (opts.LANG === lang) langBtn.style.backgroundColor = "#c3c3c3";

            langBtn.addEventListener("click", () => {
                if (opts.LANG === lang) return;
                opts.LANG = lang;
                saveOpts();
                // Rebuild UI to reflect language change (or update texts individually)
                if (uiControls) uiControls.remove(); // Remove old UI before rebuilding
                buildUI(); // Rebuild with new lang
                if (document.getElementById("42lsa-credits-version")) { // Update version string if exists
                    document.getElementById("42lsa-credits-version").textContent = f("by_shadow_team", GM_info.script.version);
                }
            });
            langBlock.appendChild(langBtn);
        });
        uiControls.appendChild(langBlock);

        document.body.appendChild(uiControls);

        // Version display
        if (!document.getElementById("42lsa-credits-version")) {
            const creditsDiv = document.createElement("div");
            Object.assign(creditsDiv.style, { position: "fixed", bottom: "10px", right: "10px", zIndex: "10000"});
            const versionSpan = document.createElement("span");
            versionSpan.id = "42lsa-credits-version";
            versionSpan.textContent = f("by_shadow_team", GM_info.script.version);
            defaultStyle(versionSpan);
            Object.assign(versionSpan.style, { padding: "3px 6px", fontSize: "0.8em", backgroundColor: "rgba(220,220,220,0.8)" });
            creditsDiv.appendChild(versionSpan);
            document.body.appendChild(creditsDiv);
        }
        log("UI built and appended.");
    };


    // --- Main Execution ---
    log("Script starting. Is Main Window?", window.top === window.self);

    if (window.top === window.self) { // Only run these in the main window context
        refreshOpts(); // Refresh/migrate options based on script version
        checkVersion(); // Check for script updates periodically
        setInterval(checkVersion, 30 * 60 * 1000); // Check every 30 minutes
    }


    window.addEventListener("load", () => {
        log("Window 'load' event fired.");

        canvas = document.querySelector('canvas.canvas_display[style*="display: block"]');
        if (!canvas) {
            canvas = document.querySelector('canvas.canvas_display'); // Fallback
        }

        if (!canvas) {
            log("Canvas element NOT FOUND after window load. Overlay/UI will not be initialized.");
            return;
        }
        log("Canvas element found:", canvas);

        // Ensure canvas parent can be a positioning context
        if (canvas.parentNode) {
            canvas.parentNode.style.position = "relative";
        }

        createOrUpdateOverlay(); // Create and style the overlay
        buildUI(); // Create and display UI controls

        if (opts.ENABLE_AUTOREFRESH) {
            startOverlayAutoRefresh();
        }

        // Setup MutationObserver to watch for canvas style changes
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    // log("Canvas style changed, updating overlay."); // Can be very noisy
                    updateOverlayStyle();
                    break; // No need to check other mutations if style already changed
                }
            }
        });

        observer.observe(canvas, {
            attributes: true,
            attributeFilter: ['style'] // Only care about the 'style' attribute
        });
        log("MutationObserver is now watching the canvas style for changes.");

        // ALSO LISTEN FOR WINDOW RESIZE EVENTS
        window.addEventListener('resize', () => {
            log("Window resized, updating overlay style.");
            updateOverlayStyle();
        });
        log("Resize listener added to window.");

    }, false);

    log("42LSA script main logic setup complete. Waiting for window load event.");

})();
