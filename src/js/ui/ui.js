import { clamp, fmt, deepClone, rgb01ToCss } from "../core/utils.js";
import { RAD_TO_DEG } from "../core/constants.js";
import { CONFIG } from "../core/config.js";
import { preferences, runtime, resolveSettings, BAND_NAMES, replacePreferences } from "../core/preferences.js";
import { state } from "../core/state.js";
import { UrlPreset } from "../presets/url-preset.js";
import { BandBankController } from "../audio/band-bank-controller.js";
import { BandBank } from "../audio/band-bank.js";
import { Queue } from "../audio/queue.js";
import { AudioEngine } from "../audio/audio-engine.js";
import { Scrubber } from "../audio/scrubber.js";
import { ColorPolicy } from "../render/color-policy.js";
import { RecorderEngine } from "../recording/recorder-engine.js";
import { initOrbs, resetOrbsToDesignedPhases } from "../render/orb-runtime.js";
import { primeDomCache } from "./dom-cache.js";

/* =============================================================================
   UI
   ========================================================================== */
const UI = (() => {
  const ui = state.ui;

  function readRecordPanelEdgeVars() {
    const placement = CONFIG.recording && CONFIG.recording.panelPlacement
      ? CONFIG.recording.panelPlacement
      : {};
    const edgeX = placement.edgeX === "left" ? "left" : "right";
    const edgeY = placement.edgeY === "top" ? "top" : "bottom";
    const edgeVars = {
      left: "auto",
      right: "auto",
      top: "auto",
      bottom: "auto",
    };

    edgeVars[edgeX] = edgeX === "left"
      ? "calc(var(--ui-pad) + var(--ui-safe-l))"
      : "calc(var(--ui-pad) + var(--ui-safe-r))";

    if (edgeY === "top") {
      edgeVars.top = "calc(var(--ui-pad) + var(--ui-safe-t))";
    } else if (placement.anchorAboveQueuePanel) {
      edgeVars.bottom = "calc(var(--ui-pad) + var(--ui-safe-b) + var(--ui-queue-clearance))";
    } else if (placement.anchorAboveAudioPanel) {
      edgeVars.bottom = "calc(var(--ui-pad) + var(--ui-safe-b) + var(--ui-audio-h) + var(--ui-gap))";
    } else {
      edgeVars.bottom = "calc(var(--ui-pad) + var(--ui-safe-b))";
    }

    return edgeVars;
  }

  function readRecordLauncherEdgeVars() {
    const placement = CONFIG.recording && CONFIG.recording.launcherPlacement
      ? CONFIG.recording.launcherPlacement
      : {};
    const corner = typeof placement.corner === "string" ? placement.corner : "bottom-right";
    const useLeft = corner.endsWith("left");
    const useTop = corner.startsWith("top");

    return {
      left: useLeft ? "calc(var(--ui-pad) + var(--ui-safe-l))" : "auto",
      right: useLeft ? "auto" : "calc(var(--ui-pad) + var(--ui-safe-r))",
      top: useTop ? "calc(var(--ui-pad) + var(--ui-safe-t))" : "auto",
      bottom: useTop ? "auto" : "calc(var(--ui-pad) + var(--ui-safe-b))",
    };
  }

  function setCssVarsFromConfig() {
    const r = document.documentElement.style;
    r.setProperty("--ui-panel-bg", CONFIG.ui.panelBackgroundRgba);
    r.setProperty("--ui-panel-blur", CONFIG.ui.panelBlurPx + "px");
    r.setProperty("--ui-pad", CONFIG.ui.panelPaddingPx + "px");
    r.setProperty("--ui-gap", CONFIG.ui.panelGapPx + "px");
    r.setProperty("--ui-radius", CONFIG.ui.panelRadiusPx + "px");
    r.setProperty("--ui-audio-h", CONFIG.ui.audioPanelHeightPx + "px");
    r.setProperty("--ui-icon", CONFIG.ui.iconButtonSizePx + "px");

    const recordPanelEdges = readRecordPanelEdgeVars();
    r.setProperty("--ui-record-panel-left", recordPanelEdges.left);
    r.setProperty("--ui-record-panel-right", recordPanelEdges.right);
    r.setProperty("--ui-record-panel-top", recordPanelEdges.top);
    r.setProperty("--ui-record-panel-bottom", recordPanelEdges.bottom);

    const recordLauncherEdges = readRecordLauncherEdgeVars();
    r.setProperty("--ui-record-launcher-left", recordLauncherEdges.left);
    r.setProperty("--ui-record-launcher-right", recordLauncherEdges.right);
    r.setProperty("--ui-record-launcher-top", recordLauncherEdges.top);
    r.setProperty("--ui-record-launcher-bottom", recordLauncherEdges.bottom);

    const recordPanelStyle = CONFIG.recording.panelStyle;
    r.setProperty("--ui-record-panel-shadow-recording", recordPanelStyle.recordingShadowCss);
    r.setProperty("--ui-record-panel-shadow-finalizing", recordPanelStyle.finalizingShadowCss);
    r.setProperty("--ui-record-panel-shadow-complete", recordPanelStyle.completeShadowCss);
    r.setProperty("--ui-record-panel-shadow-error", recordPanelStyle.errorShadowCss);

    const recordLauncherStyle = CONFIG.recording.launcherStyle;
    r.setProperty("--ui-record-launcher-rest-opacity", String(recordLauncherStyle.restOpacity));
    r.setProperty("--ui-record-launcher-border-color", recordLauncherStyle.borderColorRgba);
    r.setProperty("--ui-record-launcher-shadow", recordLauncherStyle.shadowCss);

    r.setProperty("--ui-record-launcher-pulse-period", CONFIG.recording.launcherPulse.periodMs + "ms");
    r.setProperty("--ui-record-launcher-pulse-scale-min", String(CONFIG.recording.launcherPulse.scaleMin));
    r.setProperty("--ui-record-launcher-pulse-scale-max", String(CONFIG.recording.launcherPulse.scaleMax));
    r.setProperty("--ui-record-launcher-pulse-opacity-min", String(CONFIG.recording.launcherPulse.opacityMin));
    r.setProperty("--ui-record-launcher-pulse-opacity-max", String(CONFIG.recording.launcherPulse.opacityMax));
  }

  function hideAudioPanel() {
    ui.audioPanel.style.display = "none";
    ui.openAudio.style.display = "block";
    // Queue panel is anchored above the audio panel — hide it with audio panel
    // so it doesn't float orphaned when panels are toggled with H.
    if (ui.queuePanel) ui.queuePanel.style.display = "none";
    if (document.activeElement && ui.audioPanel.contains(document.activeElement)) ui.btnOpenAudio.focus();
  }
  function showAudioPanel() {
    ui.audioPanel.style.display = "grid";
    ui.openAudio.style.display = "none";
    // Queue panel is NOT automatically reopened — user controls its visibility via ☰.
    if (document.activeElement === ui.btnOpenAudio) ui.btnHideAudio.focus();
  }

  function hideSimPanel() {
    ui.simPanel.style.display = "none";
    ui.openSim.style.display = "block";
    if (document.activeElement && ui.simPanel.contains(document.activeElement)) ui.btnOpenSim.focus();
  }
  function showSimPanel() {
    ui.simPanel.style.display = "block";
    ui.openSim.style.display = "none";
    if (document.activeElement === ui.btnOpenSim) ui.btnHideSim.focus();
  }

  function hideBandsPanel() {
    ui.bandsPanel.style.display = "none";
    ui.openBands.style.display = "block";
    if (document.activeElement && ui.bandsPanel.contains(document.activeElement)) ui.btnOpenBands.focus();
  }
  function showBandsPanel() {
    ui.bandsPanel.style.display = "block";
    ui.openBands.style.display = "none";
    if (document.activeElement === ui.btnOpenBands) ui.btnHideBands.focus();
  }

  // Record panel follows the same launcher convention as the other hideable panels:
  // panel visible means launcher hidden; panel hidden means launcher available.
  function setRecordPanelVisibility(visible) {
    if (!ui.recordPanel || !ui.openRecord) return;

    const nextVisible = !!visible && !!state.recording.hooksEnabled;
    ui.recordingPanelVisible = nextVisible;
    ui.recordPanel.hidden = !nextVisible;
    ui.recordPanel.setAttribute("aria-hidden", nextVisible ? "false" : "true");
    ui.recordPanel.style.display = nextVisible ? "block" : "none";

    const launcherVisible = !!state.recording.hooksEnabled && !nextVisible;
    ui.openRecord.hidden = !launcherVisible;
    ui.openRecord.setAttribute("aria-hidden", launcherVisible ? "false" : "true");
    ui.openRecord.style.display = launcherVisible ? "grid" : "none";
  }

  function hideRecordPanel(options = {}) {
    if (!ui.recordPanel || !ui.openRecord) return;
    const preserveRestoreFlag = !!options.preserveRestoreFlag;
    if (!preserveRestoreFlag) ui.recordingPanelRestoreAfterGlobalHide = false;
    setRecordPanelVisibility(false);
    if (document.activeElement && ui.recordPanel.contains(document.activeElement) && ui.btnOpenRecord) {
      ui.btnOpenRecord.focus();
    }
  }

  function showRecordPanel() {
    if (!ui.recordPanel || !ui.openRecord || !state.recording.hooksEnabled) return;
    ui.recordingPanelRestoreAfterGlobalHide = false;
    setRecordPanelVisibility(true);
    if (document.activeElement === ui.btnOpenRecord && ui.btnHideRecord) ui.btnHideRecord.focus();
  }

  function primeRecordUi() {
    if (!ui.recordPanel || !ui.openRecord) return;
    if (!state.recording.hooksEnabled) ui.recordingPanelRestoreAfterGlobalHide = false;
    const shouldShowPanel = !!state.recording.hooksEnabled && !!ui.recordingPanelVisible;
    setRecordPanelVisibility(shouldShowPanel);
  }

  function togglePanels() {
    const aVisible = ui.audioPanel.style.display !== "none";
    const sVisible = ui.simPanel.style.display !== "none";
    const bVisible = ui.bandsPanel.style.display !== "none";
    const qVisible = ui.queuePanel && ui.queuePanel.style.display !== "none";
    const rVisible = ui.recordPanel && ui.recordPanel.style.display !== "none";

    if (aVisible || sVisible || bVisible || qVisible || rVisible) {
      ui.recordingPanelRestoreAfterGlobalHide = !!rVisible;
      hideAudioPanel(); hideSimPanel(); hideBandsPanel();
      // hideAudioPanel already closes queuePanel
      if (rVisible) hideRecordPanel({ preserveRestoreFlag: true });
    } else {
      showAudioPanel(); showSimPanel(); showBandsPanel();
      const shouldRestoreRecordingPanel = !!ui.recordingPanelRestoreAfterGlobalHide;
      ui.recordingPanelRestoreAfterGlobalHide = false;
      if (shouldRestoreRecordingPanel) setRecordPanelVisibility(true);
    }
  }

  // 112 status-lane routing:
  // - sim lane carries sim/config toasts.
  // - audio lane carries transport/audio toasts plus a short recording-state summary.
  const STATUS_DEFAULT_SIM = "Sim panel: trace, particles, motion, analysis.";
  const STATUS_DEFAULT_BANDS = "Bands panel: colors + spectral HUD.";
  let _simStatusToastTimer = null;
  let _audioStatusToastText = "";
  let _audioStatusToastUntilMs = 0;

  function simStatusToast(msg, holdMs = 2500) {
    ui.simStatus.textContent = msg;
    if (_simStatusToastTimer) clearTimeout(_simStatusToastTimer);
    _simStatusToastTimer = setTimeout(() => {
      ui.simStatus.textContent = STATUS_DEFAULT_SIM;
      _simStatusToastTimer = null;
    }, holdMs);
  }

  function audioStatusToast(msg, holdMs = 2500) {
    _audioStatusToastText = msg;
    _audioStatusToastUntilMs = performance.now() + holdMs;
  }

  function applyPrefs(reason, options = {}) {
    const { rebuildBandsOnDefinitionChange = false } = options;
    const prevBandDefKey = BandBankController.readBandDefKey(runtime.settings);

    preferences.particles.sizeMinPx = Math.min(preferences.particles.sizeMinPx, preferences.particles.sizeMaxPx);
    preferences.particles.ttlSec = Math.max(preferences.particles.ttlSec, preferences.particles.sizeToMinSec);

    resolveSettings();

    BandBankController.syncFromSettings();
    const bandDefinitionChanged = BandBankController.readBandDefKey(runtime.settings) !== prevBandDefKey;
    if (rebuildBandsOnDefinitionChange && bandDefinitionChanged) {
      BandBankController.rebuildNow();
    }

    AudioEngine.applyAnalyserSettingsLive();
    AudioEngine.applyPlaybackSettingsLive();

    if (reason) simStatusToast(`Updated: ${reason}`);
    ui.bandsStatus.textContent = STATUS_DEFAULT_BANDS;
  }


  function resetPrefs() {
    replacePreferences(deepClone(CONFIG.defaults));
    applyPrefs("prefs reset", { rebuildBandsOnDefinitionChange: true });
    initOrbs();
    resetOrbsToDesignedPhases();
  }

  async function shareLink() {
    UrlPreset.writeHashFromPrefs();
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      simStatusToast("Share link copied to clipboard.", 4000);
    } catch {
      simStatusToast("Share link written to URL — copy from address bar.", 4000);
    }
  }

  function applyUrlNow() {
    const ok = UrlPreset.applyFromLocationHash();
    if (ok) {
      applyPrefs("applied URL preset", { rebuildBandsOnDefinitionChange: true });
      initOrbs();
      resetOrbsToDesignedPhases();
    } else {
      simStatusToast("No valid preset in URL hash.", 4000);
    }
  }

  function buildBandHudRows() {
    // Builds (or rebuilds) the band HUD rows from scratch.
    // Called by ensureBandHudBuilt() on first use, and by rebuildBandHud()
    // whenever band count changes (future builds that expose band config).
    ui.bandRowEls = [];
    ui.bandTable.innerHTML = "";

    const n = runtime.settings.bands.count;

    for (let i = 0; i < n; i++) {
      const idx = document.createElement("div");
      idx.className = "bandIdx";
      idx.textContent = String(i);

      const name = document.createElement("div");
      name.className = "bandName";
      name.textContent = BAND_NAMES[i] || `Band ${i}`;

      const range = document.createElement("div");
      range.className = "bandRange";
      range.textContent = BandBank.formatBandRangeText(i);

      const bar = document.createElement("div");
      bar.className = "bandBar";

      const fill = document.createElement("div");
      fill.className = "bandFill";
      bar.appendChild(fill);

      ui.bandTable.appendChild(idx);
      ui.bandTable.appendChild(name);
      ui.bandTable.appendChild(range);
      ui.bandTable.appendChild(bar);

      ui.bandRowEls.push({ idx, name, range, fill });
    }

    ui.bandRowsBuilt = true;
    ui.bandHudBandCount = n; // remember what count these rows were built for
  }

  function ensureBandHudBuilt() {
    // Rebuild if never built, or if band count has since changed.
    const n = runtime.settings.bands.count;
    if (!ui.bandRowsBuilt || ui.bandHudBandCount !== n) buildBandHudRows();
  }

  function rebuildBandHud() {
    // Forced rebuild — call this whenever band definition changes.
    // Currently band count is fixed at 256; this is the hook for 115+ when it becomes configurable.
    ui.bandRowsBuilt = false;
    ensureBandHudBuilt();
  }

  function refreshBandHud() {
    ensureBandHudBuilt();

    const s = runtime.settings;
    const n = s.bands.count;

    for (let i = 0; i < n; i++) {
      const e = clamp(state.bands.energies01[i] || 0, 0, 1);
      const pct = Math.round(e * 100);

      const c = ColorPolicy.bandRgb01(i);
      const alpha = 0.80;

      ui.bandRowEls[i].fill.style.width = pct + "%";
      ui.bandRowEls[i].fill.style.background = rgb01ToCss(c, alpha);

      const isDom = i === state.bands.dominantIndex;
      ui.bandRowEls[i].name.style.opacity = isDom ? "1.0" : "0.75";
      ui.bandRowEls[i].idx.style.opacity = isDom ? "1.0" : "0.65";
      ui.bandRowEls[i].range.style.opacity = isDom ? "0.96" : "0.72";
      ui.bandRowEls[i].range.textContent = BandBank.formatBandRangeText(i);
    }

    const domIdx = clamp(state.bands.dominantIndex, 0, n - 1);
    const domName = state.bands.dominantName || BAND_NAMES[domIdx] || `Band ${domIdx}`;
    const domRange = BandBank.formatBandRangeText(domIdx);
    ui.bandDebug.textContent = "";
    const span = document.createElement("span");
    span.className = "dominantBadge";
    span.textContent = `Dominant [${domIdx}] ${domName} — ${domRange}`;
    ui.bandDebug.appendChild(span);
  }

  function formatBandMetaHz(hz) {
    if (!Number.isFinite(hz)) return "n/a";
    if (hz >= 1000) return `${fmt(hz / 1000, 2)} kHz`;
    return `${fmt(hz, 1)} Hz`;
  }

  function refreshBandMetaText() {
    const m = state.bands.meta;
    const bandCount = runtime.settings.bands.count;
    const sampleRateText = Number.isFinite(m.sampleRateHz)
      ? formatBandMetaHz(m.sampleRateHz)
      : "pending audio context";
    ui.bandMeta.textContent = `${bandCount} bands • Nyquist ${formatBandMetaHz(m.nyquistHz)} • ceiling configured ${formatBandMetaHz(m.configCeilingHz)}`;
  }

  function collectOperatorFacingControls() {
    // 112 
    // This intentionally excludes buttons and transport-only affordances.
    const selectors = [
      "#audioPanel input",
      "#audioPanel select",
      "#simPanel input",
      "#simPanel select",
      "#bandsPanel input",
      "#bandsPanel select",
      "#recordPanel input",
      "#recordPanel select",
    ];
    const controls = [];
    const seenIds = new Set();
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (!el || !el.id || el.type === "hidden" || el.type === "file") continue;
        if (seenIds.has(el.id)) continue;
        seenIds.add(el.id);
        controls.push(el);
      }
    }
    return controls;
  }

  function findLabelForControl(control) {
    if (!control) return "Control";

    const ownLabel = control.closest("label");
    if (ownLabel) return ownLabel.textContent.replace(/\s+/g, " ").trim();

    const allLabels = document.querySelectorAll("label[for]");
    for (const label of allLabels) {
      if (label.htmlFor === control.id) return label.textContent.replace(/\s+/g, " ").trim();
    }

    const row = control.closest(".row");
    const rowLabel = row ? row.querySelector("label") : null;
    if (rowLabel) return rowLabel.textContent.replace(/\s+/g, " ").trim();

    return control.id;
  }

  function findValueElementForControl(control) {
    if (!control) return null;
    const row = control.closest(".row");
    return row ? row.querySelector(".val") : null;
  }

  function fallbackFeedbackValue(control) {
    if (!control) return "";
    if (control.type === "checkbox") return control.checked ? "on" : "off";
    if (control.type === "color") return String(control.value || "").toLowerCase();
    if (control.tagName === "SELECT") {
      const option = control.options && control.selectedIndex >= 0 ? control.options[control.selectedIndex] : null;
      return option ? option.textContent.trim() : String(control.value || "");
    }
    return String(control.value || "");
  }

  function initConfigTooltips() {
    const controls = collectOperatorFacingControls();
    ui.configTooltipSpecs = controls.map((control) => ({
      control,
      label: findLabelForControl(control),
      valueEl: findValueElementForControl(control),
      staticTitle: (control.getAttribute("title") || "").trim(),
    }));

    ui.configTooltipByControl = new Map();
    for (const spec of ui.configTooltipSpecs) ui.configTooltipByControl.set(spec.control, spec);
  }

  function getConfigTooltipLiveValue(spec) {
    if (!spec || !spec.control) return "";
    const control = spec.control;
    const fromReadout = spec.valueEl && spec.valueEl.textContent
      ? spec.valueEl.textContent.trim()
      : "";
    return fromReadout || fallbackFeedbackValue(control).trim();
  }

  function refreshConfigTooltipForControl(control) {
    if (!control || !ui.configTooltipByControl) return;
    const spec = ui.configTooltipByControl.get(control);
    if (!spec) return;

    const liveValue = getConfigTooltipLiveValue(spec);
    const liveTitle = `${spec.label}: ${liveValue}`;
    control.title = spec.staticTitle ? `${spec.staticTitle}\n${liveTitle}` : liveTitle;
  }

  function refreshConfigTooltips() {
    const specs = Array.isArray(ui.configTooltipSpecs) ? ui.configTooltipSpecs : [];
    for (const spec of specs) refreshConfigTooltipForControl(spec.control);
  }

  function wireConfigTooltipFeedbackEvents() {
    const specs = Array.isArray(ui.configTooltipSpecs) ? ui.configTooltipSpecs : [];
    for (const spec of specs) {
      const control = spec.control;
      if (!control) continue;
      const eventName = (control.type === "checkbox" || control.tagName === "SELECT") ? "change" : "input";
      control.addEventListener(eventName, () => {
        // Apply handlers run in the same event turn. Queue after them so titles
        // reflect the same formatted value text that .val readouts display.
        queueMicrotask(() => refreshConfigTooltipForControl(control));
      });
      control.addEventListener("focus", () => refreshConfigTooltipForControl(control));
      control.addEventListener("mouseenter", () => refreshConfigTooltipForControl(control));
    }
  }

  function formatRecordingElapsedMs(elapsedMs) {
    const totalSec = Math.max(0, Math.floor((Number.isFinite(elapsedMs) ? elapsedMs : 0) / 1000));
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  // Audio status can mention recording state, but recording controls stay
  // anchored to the dedicated record panel and launcher.
  function formatRecordingAudioStatusSummary(recording) {
    if (!recording || !recording.hooksEnabled) return "";
    switch (recording.phase) {
      case "recording":
        return `Rec ${formatRecordingElapsedMs(recording.elapsedMs)}`;
      case "finalizing":
        return "Rec finalizing";
      case "complete":
        return "Export ready";
      case "error":
        return "Rec error";
      case "unsupported":
        return "Rec unavailable";
      default:
        return "";
    }
  }

  function formatRecordingByteCount(byteCount) {
    return Number.isFinite(byteCount) && byteCount > 0
      ? `${Math.round(byteCount)} bytes`
      : "0 bytes";
  }

  function shouldSurfaceRecordingLastMessage(recording) {
    if (!recording || !recording.lastMessage) return false;
    if (recording.phase === "error") return true;
    return [
      "already-recording",
      "not-recording",
      "invalid-mime-type",
      "settings-locked",
      "reset-blocked",
      "unknown-recording-action",
    ].includes(recording.lastCode);
  }

  function isRecordingAudioCurrentlyUnavailable(recording) {
    if (!recording || recording.phase !== "recording") return false;
    return !state.audio.isLoaded
      || recording.lastCode === "audio-unloaded"
      || recording.lastCode === "track-change-failed";
  }

  function formatRecordingPrimaryStatus(recording) {
    if (!recording || !recording.hooksEnabled) return "Recording disabled";
    if (shouldSurfaceRecordingLastMessage(recording)) return recording.lastMessage;

    const includeAudio = recording.includePlaybackAudio !== false;
    switch (recording.phase) {
      case "boot-pending":
      case "uninitialized":
        return "Checking recording support";
      case "unsupported":
        return "Recording unavailable";
      case "recording":
        if (isRecordingAudioCurrentlyUnavailable(recording)) return "Recording continues without loaded audio";
        return includeAudio ? "Recording audio + video" : "Recording video only";
      case "finalizing":
        return "Finalizing export";
      case "complete":
        return "Latest export ready";
      case "idle":
        if (recording.isSupported !== true) return "Checking recording support";
        if (!state.audio.isLoaded) return "Load audio to start recording";
        return includeAudio ? "Ready to record" : "Ready to record video only";
      default:
        return recording.lastMessage || "Checking recording support";
    }
  }

  function formatRecordingSupportText(recording) {
    if (!recording || !recording.hooksEnabled || recording.phase === "disabled") {
      return "Recording is disabled by configuration.";
    }
    if (isRecordingAudioCurrentlyUnavailable(recording)) {
      return "Recording continues while no audio is currently loaded.";
    }
    if (recording.isSupported === true) {
      return recording.includePlaybackAudio !== false
        ? "Audio + video capture available."
        : "Video-only capture available.";
    }
    if (recording.isSupported === null || recording.phase === "boot-pending" || recording.supportProbeStatus === "not-started") {
      return "Checking recording capability.";
    }
    const reason = recording.lastCode || recording.supportProbeStatus || "unsupported";
    return `Unavailable: ${reason}.`;
  }

  function formatRecordingExportMeta(recording) {
    const hasExport = !!recording && !!recording.lastExportUrl && !!recording.lastExportFileName;
    if (!hasExport) return "Latest export: none this session.";
    const byteText = formatRecordingByteCount(recording.lastExportByteSize);
    return `Latest export: ${recording.lastExportFileName} (${byteText})`;
  }

  function readRecordingTimerText(recording) {
    const showCapturedDuration = recording
      && (
        recording.phase === "recording"
        || recording.phase === "finalizing"
        || recording.phase === "complete"
        || (recording.phase === "error" && Number.isFinite(recording.elapsedMs) && recording.elapsedMs > 0)
      );
    return formatRecordingElapsedMs(showCapturedDuration ? recording.elapsedMs : 0);
  }

  function readRecordingLauncherLabel(recording) {
    if (!recording || !recording.hooksEnabled) return "Show recording panel";
    switch (recording.phase) {
      case "recording":
        return "Show recording panel (recording active)";
      case "finalizing":
        return "Show recording panel (finalizing export)";
      case "unsupported":
        return "Show recording panel (recording unavailable)";
      default:
        return "Show recording panel";
    }
  }

  function syncRecordingMimeOptions(model) {
    if (!ui.selRecordMime) return;
    const availableMimeTypes = Array.isArray(model.recording.availableMimeTypes)
      ? model.recording.availableMimeTypes
      : [];
    const selectedMimeType = model.recording.selectedMimeType || "";
    const optionsKey = `${availableMimeTypes.join("|")}::${selectedMimeType}`;

    if (ui.recordMimeOptionsKey !== optionsKey) {
      ui.selRecordMime.innerHTML = "";
      if (!availableMimeTypes.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Unavailable";
        ui.selRecordMime.appendChild(opt);
      } else {
        for (const mimeType of availableMimeTypes) {
          const opt = document.createElement("option");
          opt.value = mimeType;
          opt.textContent = mimeType;
          opt.selected = mimeType === selectedMimeType;
          ui.selRecordMime.appendChild(opt);
        }
      }
      ui.recordMimeOptionsKey = optionsKey;
    }

    ui.selRecordMime.value = availableMimeTypes.includes(selectedMimeType)
      ? selectedMimeType
      : (availableMimeTypes[0] || "");
  }

  function syncRecordingTargetFpsOptions(model) {
    if (!ui.selRecordTargetFps) return;
    const options = Array.isArray(model.targetFpsOptions) ? model.targetFpsOptions : [];
    const selectedValue = Number.isFinite(model.recording.targetFps) ? model.recording.targetFps : null;
    const optionsKey = `${options.join("|")}::${selectedValue}`;

    if (ui.recordTargetFpsOptionsKey !== optionsKey) {
      ui.selRecordTargetFps.innerHTML = "";
      for (const fps of options) {
        const opt = document.createElement("option");
        opt.value = String(fps);
        opt.textContent = `${fps} fps`;
        opt.selected = fps === selectedValue;
        ui.selRecordTargetFps.appendChild(opt);
      }
      ui.recordTargetFpsOptionsKey = optionsKey;
    }

    ui.selRecordTargetFps.value = options.includes(selectedValue)
      ? String(selectedValue)
      : String(options[0] || "");
  }

  function downloadLastRecording() {
    const recording = state.recording;
    if (!recording || !recording.lastExportUrl || !recording.lastExportFileName) return;
    const a = document.createElement("a");
    a.href = recording.lastExportUrl;
    a.download = recording.lastExportFileName;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function getRecordingUiModel() {
    const recording = state.recording;
    const includeAudio = recording.includePlaybackAudio !== false;
    const hasCompleteExport = !!recording.lastExportUrl && !!recording.lastExportFileName;
    const canEditSettings = recording.hooksEnabled
      && recording.phase !== "recording"
      && recording.phase !== "finalizing";
    const canStartPhase = recording.phase === "idle"
      || recording.phase === "complete"
      || recording.phase === "error";
    return {
      config: CONFIG.recording,
      recording,
      includeAudio,
      panelVisible: !!ui.recordingPanelVisible,
      canStart: recording.hooksEnabled
        && recording.isSupported === true
        && !!state.audio.isLoaded
        && canStartPhase,
      canStop: recording.phase === "recording",
      canDownload: hasCompleteExport,
      canSelectMime: canEditSettings && recording.isSupported === true,
      canToggleIncludeAudio: canEditSettings,
      canSelectTargetFps: canEditSettings,
      timerText: readRecordingTimerText(recording),
      launcherLabel: readRecordingLauncherLabel(recording),
      primaryStatusText: formatRecordingPrimaryStatus(recording),
      supportText: formatRecordingSupportText(recording),
      exportMetaText: formatRecordingExportMeta(recording),
      selectedMimeLabel: recording.selectedMimeType || "n/a",
      resolvedMimeLabel: recording.resolvedMimeType || "n/a",
      includeAudioLabel: includeAudio ? "On" : "Off",
      targetFpsLabel: Number.isFinite(recording.targetFps) ? `${recording.targetFps} fps` : "n/a",
      targetFpsOptions: Array.isArray(CONFIG.recording && CONFIG.recording.targetFpsOptions)
        ? CONFIG.recording.targetFpsOptions.slice()
        : [],
    };
  }

  function buildRecordingUiSyncKey() {
    const recording = state.recording;
    return [
      recording.lastUpdatedAtMs == null ? "null" : String(recording.lastUpdatedAtMs),
      recording.phase || "",
      recording.includePlaybackAudio ? "1" : "0",
      Number.isFinite(recording.targetFps) ? String(recording.targetFps) : "na",
      recording.selectedMimeType || "",
      recording.resolvedMimeType || "",
      recording.lastExportUrl || "",
      recording.lastExportFileName || "",
      state.audio.isLoaded ? "1" : "0",
      ui.recordingPanelVisible ? "1" : "0",
    ].join("|");
  }

  function refreshRecordingUi() {
    const model = getRecordingUiModel();
    const recording = model.recording;

    // Build 113 record UI reads directly from state.recording. Keep one status authority.
    if (ui.recordPanel && ui.recordPanel.dataset.recordingPhase !== recording.phase) {
      ui.recordPanel.dataset.recordingPhase = recording.phase;
    }
    if (ui.recordPanel) ui.recordPanel.setAttribute("aria-busy", recording.phase === "finalizing" ? "true" : "false");
    if (ui.openRecord && ui.openRecord.dataset.recordingPhase !== recording.phase) {
      ui.openRecord.dataset.recordingPhase = recording.phase;
    }
    if (ui.openRecord) ui.openRecord.classList.toggle("is-recording", recording.phase === "recording");
    if (ui.btnOpenRecord) {
      if (ui.btnOpenRecord.title !== model.launcherLabel) ui.btnOpenRecord.title = model.launcherLabel;
      if (ui.btnOpenRecord.getAttribute("aria-label") !== model.launcherLabel) {
        ui.btnOpenRecord.setAttribute("aria-label", model.launcherLabel);
      }
    }

    syncRecordingMimeOptions(model);
    syncRecordingTargetFpsOptions(model);

    if (ui.recordTimer && ui.recordTimer.textContent !== model.timerText) {
      ui.recordTimer.textContent = model.timerText;
    }
    if (ui.valRecordMime && ui.valRecordMime.textContent !== model.resolvedMimeLabel) {
      ui.valRecordMime.textContent = model.resolvedMimeLabel;
    }
    if (ui.valRecordPreferredMime && ui.valRecordPreferredMime.textContent !== model.selectedMimeLabel) {
      ui.valRecordPreferredMime.textContent = model.selectedMimeLabel;
    }
    if (ui.valRecordIncludeAudio && ui.valRecordIncludeAudio.textContent !== model.includeAudioLabel) {
      ui.valRecordIncludeAudio.textContent = model.includeAudioLabel;
    }
    if (ui.valRecordTargetFps && ui.valRecordTargetFps.textContent !== model.targetFpsLabel) {
      ui.valRecordTargetFps.textContent = model.targetFpsLabel;
    }

    if (ui.recordStatus && ui.recordStatus.textContent !== model.primaryStatusText) {
      ui.recordStatus.textContent = model.primaryStatusText;
    }

    if (ui.recordSupport && ui.recordSupport.textContent !== model.supportText) {
      ui.recordSupport.textContent = model.supportText;
    }

    if (ui.recordExportMeta && ui.recordExportMeta.textContent !== model.exportMetaText) {
      ui.recordExportMeta.textContent = model.exportMetaText;
    }

    if (ui.chkRecordIncludeAudio) {
      ui.chkRecordIncludeAudio.checked = !!recording.includePlaybackAudio;
      ui.chkRecordIncludeAudio.disabled = !model.canToggleIncludeAudio;
    }
    if (ui.btnRecordStart) ui.btnRecordStart.disabled = !model.canStart;
    if (ui.btnRecordStop) ui.btnRecordStop.disabled = !model.canStop;
    if (ui.btnRecordDownloadLast) ui.btnRecordDownloadLast.disabled = !model.canDownload;
    if (ui.selRecordMime) ui.selRecordMime.disabled = !model.canSelectMime;
    if (ui.selRecordTargetFps) ui.selRecordTargetFps.disabled = !model.canSelectTargetFps;
    ui.recordingUiSyncKey = buildRecordingUiSyncKey();
  }

  function maybeRefreshRecordingUi() {
    const syncKey = buildRecordingUiSyncKey();
    if (ui.recordingUiSyncKey === syncKey) return;
    refreshRecordingUi();
  }

  function dispatchRecordingAction(action, options = {}) {
    let result;

    switch (action) {
      case "support":
        result = RecorderEngine.getSupportStatus();
        break;
      case "start":
        result = RecorderEngine.start(options);
        break;
      case "stop":
        result = RecorderEngine.stop();
        break;
      case "selectMime":
        result = RecorderEngine.selectMimeType(options.mimeType);
        break;
      case "setIncludeAudio":
        result = RecorderEngine.setIncludePlaybackAudio(!!options.enabled);
        break;
      case "setTargetFps":
        result = RecorderEngine.setTargetFps(Number(options.fps));
        break;
      case "reset":
        result = RecorderEngine.reset();
        break;
      default:
        result = {
          ok: false,
          code: "unknown-recording-action",
          message: `Unknown recording action: ${action}`,
          phase: state.recording.phase,
        };
        break;
    }

    refreshRecordingUi();
    return result;
  }

  function refreshAllUiText(bandSnapshot) {
    const p = preferences;
    maybeRefreshRecordingUi();

    const bandText = bandSnapshot && bandSnapshot.ready
      ? (bandSnapshot.monoLike ? "mono-ish (L≈R)" : "stereo (L≠R)")
      : "n/a";

    const recordingStatusText = formatRecordingAudioStatusSummary(state.recording);

    // audioStatus: always show [pos/len] queue position when audio is loaded.
    // Guarded to avoid invalid display if transport and queue are temporarily out of sync.
    const hasAudioToast = performance.now() < _audioStatusToastUntilMs;

    if (state.audio.isLoaded) {
      const qLen = Queue.length;
      const qPos = qLen > 0 ? clamp(Queue.currentIndex + 1, 1, qLen) : 0; // 1-based for display
      const playState = state.audio.isPlaying ? " (playing)" : " (paused)";
      const errText = state.audio.transportError ? ` — Error: ${state.audio.transportError}` : "";
      const computedAudioStatus = `[${qPos}/${qLen}] ${state.audio.filename}${playState} — Bands: ${bandText}${errText}`;
      const audioStatusText = `${computedAudioStatus} | ${recordingStatusText}`;
      ui.audioStatus.textContent = hasAudioToast ? _audioStatusToastText : (recordingStatusText ? audioStatusText : computedAudioStatus);
    } else {
      const computedAudioStatus = state.audio.transportError ? `No audio loaded. Error: ${state.audio.transportError}` : "No audio loaded.";
      const audioStatusText = `${computedAudioStatus} | ${recordingStatusText}`;
      ui.audioStatus.textContent = hasAudioToast ? _audioStatusToastText : (recordingStatusText ? audioStatusText : computedAudioStatus);
    }

    ui.btnPlay.disabled = !state.audio.isLoaded;
    ui.btnStop.disabled = !state.audio.isLoaded;
    ui.btnPlay.textContent = state.audio.isPlaying ? "Pause" : "Play";

    // Manual transport buttons: boundary-aware by default; wrap at boundaries when Repeat=All.
    const repeatAllWrap = preferences.audio.repeatMode === "all" && Queue.length > 1;
    ui.btnPrev.disabled = !(Queue.canPrev() || repeatAllWrap);
    ui.btnNext.disabled = !(Queue.canNext() || repeatAllWrap);

    ui.btnRepeat.textContent = `Repeat: ${p.audio.repeatMode === "one" ? "One" : (p.audio.repeatMode === "all" ? "All" : "Off")}`;
    ui.btnShuffle.disabled = Queue.length < 3;
    ui.chkMute.checked = !!p.audio.muted;
    ui.rngVol.value = String(p.audio.volume);
    ui.valVol.textContent = fmt(p.audio.volume, 2);

    ui.chkLines.checked = !!p.trace.lines;
    ui.valLines.textContent = p.trace.lines ? "on" : "off";
    ui.rngNumLines.value = String(p.trace.numLines);
    ui.valNumLines.textContent = `${p.trace.numLines}`;

    ui.selLineColorMode.value = p.trace.lineColorMode;
    ui.valLineColorMode.textContent = p.trace.lineColorMode;

    ui.rngEmit.value = String(p.particles.emitPerSecond);
    ui.valEmit.textContent = `${p.particles.emitPerSecond}/s`;

    ui.rngSizeMax.value = String(p.particles.sizeMaxPx);
    ui.valSizeMax.textContent = `${p.particles.sizeMaxPx}px`;

    ui.rngSizeMin.value = String(p.particles.sizeMinPx);
    ui.valSizeMin.textContent = `${p.particles.sizeMinPx}px`;

    ui.rngSizeToMin.value = String(p.particles.sizeToMinSec);
    ui.valSizeToMin.textContent = `${fmt(p.particles.sizeToMinSec, 1)}s`;

    ui.rngTTL.value = String(p.particles.ttlSec);
    const fadeSec = Math.max(0, p.particles.ttlSec - p.particles.sizeToMinSec);
    ui.valTTL.textContent = `${fmt(p.particles.ttlSec, 1)}s (fade ${fmt(fadeSec, 1)}s)`;

    ui.rngOverlap.value = String(p.particles.overlapRadiusPx);
    ui.valOverlap.textContent = `${fmt(p.particles.overlapRadiusPx, 1)}px`;

    ui.rngOmega.value = String(p.motion.angularSpeedRadPerSec);
    ui.valOmega.textContent = `${fmt(p.motion.angularSpeedRadPerSec, 3)} rad/s (${fmt(p.motion.angularSpeedRadPerSec * RAD_TO_DEG, 1)}°/s)`;

    ui.rngWfDisp.value = String(p.motion.waveformRadialDisplaceFrac);
    ui.valWfDisp.textContent = fmt(p.motion.waveformRadialDisplaceFrac, 3);

    ui.rngRmsGain.value = String(p.audio.rmsGain);
    ui.valRmsGain.textContent = fmt(p.audio.rmsGain, 2);

    ui.rngMinRad.value = String(p.audio.minRadiusFrac);
    ui.valMinRad.textContent = fmt(p.audio.minRadiusFrac, 3);

    ui.rngMaxRad.value = String(p.audio.maxRadiusFrac);
    ui.valMaxRad.textContent = fmt(p.audio.maxRadiusFrac, 3);

    ui.rngSmooth.value = String(p.audio.smoothingTimeConstant);
    ui.valSmooth.textContent = fmt(p.audio.smoothingTimeConstant, 2);

    ui.selFFT.value = String(p.audio.fftSize);
    ui.valFFT.textContent = `${p.audio.fftSize}`;

    ui.clrBg.value = p.visuals.backgroundColor;
    ui.valBg.textContent = p.visuals.backgroundColor;

    ui.clrParticle.value = p.visuals.particleColor;
    ui.valParticle.textContent = p.visuals.particleColor;

    ui.selParticleColorSrc.value = p.bands.particleColorSource;
    ui.valParticleSrc.textContent = p.bands.particleColorSource;

    ui.selDistMode.value = p.bands.distributionMode;
    ui.valDistMode.textContent = p.bands.distributionMode;

    ui.chkBandOverlay.checked = !!p.bands.overlay.enabled;
    ui.valBandOverlay.textContent = p.bands.overlay.enabled ? "on" : "off";

    ui.chkBandConnect.checked = !!p.bands.overlay.connectAdjacent;
    ui.valBandConnect.textContent = p.bands.overlay.connectAdjacent ? "on" : "off";

    ui.rngBandAlpha.value = String(p.bands.overlay.alpha);
    ui.valBandAlpha.textContent = fmt(p.bands.overlay.alpha, 2);

    ui.rngBandPoint.value = String(p.bands.overlay.pointSizePx);
    ui.valBandPoint.textContent = `${p.bands.overlay.pointSizePx}px`;

    ui.rngBandOverlayMinRad.value = String(p.bands.overlay.minRadiusFrac);
    ui.valBandOverlayMinRad.textContent = fmt(p.bands.overlay.minRadiusFrac, 3);

    ui.rngBandOverlayMaxRad.value = String(p.bands.overlay.maxRadiusFrac);
    ui.valBandOverlayMaxRad.textContent = fmt(p.bands.overlay.maxRadiusFrac, 3);

    ui.rngBandOverlayWfDisp.value = String(p.bands.overlay.waveformRadialDisplaceFrac);
    ui.valBandOverlayWfDisp.textContent = fmt(p.bands.overlay.waveformRadialDisplaceFrac, 3);

    ui.selRingPhaseMode.value = p.bands.overlay.phaseMode;
    ui.valRingPhaseMode.textContent = p.bands.overlay.phaseMode;

    ui.rngRingSpeed.value = String(p.bands.overlay.ringSpeedRadPerSec);
    ui.valRingSpeed.textContent = `${fmt(p.bands.overlay.ringSpeedRadPerSec, 2)} rad/s`;

    ui.rngHueOff.value = String(p.bands.rainbow.hueOffsetDeg);
    ui.valHueOff.textContent = `${p.bands.rainbow.hueOffsetDeg}°`;

    ui.rngSat.value = String(p.bands.rainbow.saturation);
    ui.valSat.textContent = fmt(p.bands.rainbow.saturation, 2);

    ui.rngVal.value = String(p.bands.rainbow.value);
    ui.valVal.textContent = fmt(p.bands.rainbow.value, 2);

    refreshConfigTooltips();
    refreshRecordingUi();

    refreshBandMetaText();

    if (bandSnapshot && bandSnapshot.ready) {
      const nowMs = performance.now();
      const hudIntervalMs = ui.bandHudIntervalMs || 100;
      const bandsPanelVisible = ui.bandsPanel && ui.bandsPanel.style.display !== "none";
      const canRefreshHud = bandsPanelVisible && (nowMs - ui.lastBandHudUpdateMs >= hudIntervalMs);
      if (canRefreshHud) {
        refreshBandHud();
        ui.lastBandHudUpdateMs = nowMs;
      }
    }
  }

  function wireControls() {
    primeDomCache();

    initConfigTooltips();


    /* -------------------------------------------------------------------------
       clearAudioState() — canonical clean-slate reset for all stop/clear paths.

       3.4 — Clear queue clean-slate audit. Every item the checklist requires:
         ✓ state.audio.isLoaded = false    — set explicitly below
         ✓ state.audio.filename = ""       — set explicitly below
         ✓ state.audio.isPlaying = false   — set explicitly below
         ✓ AudioEngine.unload()            — caller must call before this function
         ✓ All orb trails reset            — loop below
         ✓ Scrubber blank                  — Scrubber.reset()
         ✓ Play/Stop buttons disabled      — driven by state.audio.isLoaded in refreshAllUiText
         ✓ Prev/Next buttons disabled      — driven by Queue.canPrev/canNext;
                                             caller must call Queue.clear() first
         ✓ No blob URLs left alive         — revoked by loadeddata/error during track
                                             lifetime; AudioEngine.unload() performs
                                             teardown() and final release safety.
      Build 113 policy: queue clear/unload stays transport-owned here. If recording is
      active, RecorderEngine is notified after transport reset so capture can
      continue without loaded audio, without mutating this reset path.
       Called by: remove-button handler (active track removed, queue now empty)
                  btnClearQueue handler
       Callers must call AudioEngine.unload() and Queue.clear() before this.
       ------------------------------------------------------------------------- */
    function clearAudioState() {
      state.audio.isLoaded = false;
      state.audio.isPlaying = false;
      state.audio.filename = "";
      state.audio.transportError = "";
      resetTrackVisualState();
    }

    function resetTrackVisualState() {
      Scrubber.reset();
      for (const orb of state.orbs) orb.resetTrail();
      state.bands.energies01.fill(0);
      state.bands.dominantIndex = 0;
      state.bands.dominantName = "(none)";
      refreshBandHud();
    }

    /* -------------------------------------------------------------------------
       loadAndPlay — single shared helper for all track-change paths.

       3.1 — Entry-point audit. Every path that changes the current track routes
       through here so trail reset + scrubber reset happen in exactly one place:
         (1) _onTrackEnded repeat policy → loadAndPlay/stop     [auto-advance/repeat]
         (2) fileInput change → loadAndPlay                    [Load button, 1st track]
         (3) drop handler    → loadAndPlay                     [drag-drop, 1st track]
         (4) btnNext click   → Queue.next() → loadAndPlay
         (5) btnPrev click   → Queue.prev() → loadAndPlay
         (6) queue row click → Queue.goTo() → loadAndPlay      [click-to-jump]
         (7) remove handler  → loadAndPlay  (wasActive && nextFile case)
      Build 113 policy: active recording spans track changes through this path.
      Notify RecorderEngine, but do not add recorder-specific transport branching.
       DoD: no trail bleed between tracks; scrubber never shows stale waveform.
       ------------------------------------------------------------------------- */
    let activeLoadRequestId = 0;

    async function loadAndPlay(file, opts = {}) {
      if (!file) return false;
      const requestId = ++activeLoadRequestId;
      state.audio.transportError = "";
      RecorderEngine.onTransportMutation("track-change-start", {
        requestId,
        filename: file && file.name ? file.name : "",
      });
      // Hard reset visual state immediately on every track switch so no stale
      // waveform/playhead, trail particles, or dominant band state can persist.
      resetTrackVisualState();
      const ok = await AudioEngine.loadFile(file, requestId, opts);
      if (requestId !== activeLoadRequestId) return false;
      if (!ok) {
        RecorderEngine.onTransportMutation("track-change-failed", {
          requestId,
          filename: file && file.name ? file.name : "",
          error: state.audio.transportError || "",
        });
        audioStatusToast(state.audio.transportError || "Playback failed.", 6000);
        refreshQueuePanel();
        return false;
      }
      Scrubber.loadFile(file); // async — decode in background; playback may be play or paused by opts
      applyPrefs(null);
      RecorderEngine.onTransportMutation("track-change-complete", {
        requestId,
        filename: file && file.name ? file.name : "",
      });
      if (state.audio.transportError) audioStatusToast(state.audio.transportError, 6000);
      else audioStatusToast(`Loaded: ${file.name}`, 2500);
      // Dismiss first-run hint permanently on first successful load
      const hint = document.getElementById("loadHint");
      if (hint) { hint.classList.add("hidden"); setTimeout(() => hint.remove(), 700); }
      refreshQueuePanel();
      return true;
    }

    /* Register _onTrackEnded hook once at boot.
       Single source of truth for queue-aware repeat behavior on natural track end.
       The hook survives teardown() intentionally — registered once at boot,
       must persist across track loads. Documented in 111c/111d. */
    AudioEngine._isLoadRequestCurrent = (requestId) => requestId === activeLoadRequestId;

    AudioEngine._onTrackEnded = () => {
      const mode = preferences.audio.repeatMode;

      if (mode === "one") {
        const file = Queue.current();
        if (file) loadAndPlay(file);
        return;
      }

      if (Queue.canNext()) {
        const file = Queue.next();
        if (file) loadAndPlay(file);
        return;
      }

      if (mode === "all" && Queue.length > 0) {
        const file = Queue.goTo(0);
        if (file) loadAndPlay(file);
        return;
      }
      // mode=none at queue end: playback ends, but active recording continues
      // until the user explicitly stops it.
      RecorderEngine.onTransportMutation("audio-unloaded", {
        reason: "track-ended-no-next",
      });
    };

    function activateQueueRow(trackIndex) {
      const file = Queue.goTo(trackIndex);
      if (file) loadAndPlay(file);
    }

    /* Queue panel renderer — rebuilds list DOM from Queue.snapshot().
       each row is keyboard-reachable and declared as a button-like activator. */
    function refreshQueuePanel() {
      if (!ui.queueList) return;
      const snap = Queue.snapshot();
      ui.queueList.innerHTML = "";
      for (const item of snap.items) {
        const row = document.createElement("div");
        row.className = "queue-item" + (item.active ? " active" : "");
        row.title = item.name;
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.setAttribute("aria-label", `Play queue item ${item.index + 1}: ${item.name}`);
        row.setAttribute("aria-current", item.active ? "true" : "false");

        const idx = document.createElement("span");
        idx.className = "q-idx";
        idx.textContent = String(item.index + 1);

        const name = document.createElement("span");
        name.className = "q-name";
        name.textContent = item.name;

        const removeBtn = document.createElement("button");
        removeBtn.className = "q-remove";
        removeBtn.textContent = "×";
        removeBtn.title = "Remove from queue";
        removeBtn.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            removeBtn.click();
          }
        });
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation(); // prevent row click-to-jump
          const wasActive = item.active;
          const wasPlaying = state.audio.isPlaying;
          const nextFile = Queue.remove(item.index);
          if (wasActive && nextFile) {
            // Removed active track. Successor is loaded preserving prior play/pause intent.
            loadAndPlay(nextFile, { autoPlay: wasPlaying });
          } else if (wasActive && Queue.length === 0) {
            // Removed the active track and queue is now empty — full clean slate.
            AudioEngine.unload();
            clearAudioState(); // 3.4 — via shared helper; see clearAudioState() for audit
          }
          if (wasActive && Queue.length === 0) {
            RecorderEngine.onTransportMutation("audio-unloaded", {
              reason: "active-remove-empty-queue",
            });
          }
          // wasActive === false: non-active track removed, playback unaffected.
          refreshQueuePanel();
        });

        row.appendChild(idx);
        row.appendChild(name);
        row.appendChild(removeBtn);

        // Row activation: click or keyboard (Enter/Space) jumps to that track.
        row.addEventListener("click", () => {
          activateQueueRow(item.index);
        });
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activateQueueRow(item.index);
          }
        });

        ui.queueList.appendChild(row);
      }
    }

    wireConfigTooltipFeedbackEvents();
    primeRecordUi();
    refreshRecordingUi();

    if (ui.btnHideRecord) ui.btnHideRecord.addEventListener("click", () => {
      hideRecordPanel();
    });
    if (ui.btnOpenRecord) ui.btnOpenRecord.addEventListener("click", () => {
      showRecordPanel();
    });
    if (ui.btnRecordStart) ui.btnRecordStart.addEventListener("click", () => {
      dispatchRecordingAction("start");
    });
    if (ui.btnRecordStop) ui.btnRecordStop.addEventListener("click", () => {
      dispatchRecordingAction("stop");
    });
    if (ui.selRecordMime) ui.selRecordMime.addEventListener("change", () => {
      dispatchRecordingAction("selectMime", { mimeType: ui.selRecordMime.value });
    });
    if (ui.chkRecordIncludeAudio) ui.chkRecordIncludeAudio.addEventListener("change", () => {
      dispatchRecordingAction("setIncludeAudio", { enabled: ui.chkRecordIncludeAudio.checked });
    });
    if (ui.selRecordTargetFps) ui.selRecordTargetFps.addEventListener("change", () => {
      dispatchRecordingAction("setTargetFps", { fps: Number(ui.selRecordTargetFps.value) });
    });
    if (ui.btnRecordDownloadLast) ui.btnRecordDownloadLast.addEventListener("click", () => {
      downloadLastRecording();
    });

    /* Events */
    // fileInput.value reset (checklist 3.7): cleared before every picker open so
    // the same file can be loaded a second time. The drag-drop path uses
    // dataTransfer.files directly — it never touches fileInput — so no reset
    // is needed there. This is the only fileInput add path; invariant maintained.
    ui.btnLoad.addEventListener("click", () => { ui.fileInput.value = ""; ui.fileInput.click(); });

	ui.fileInput.addEventListener("change", async () => {
		const files = Array.from(ui.fileInput.files || []).filter(f => f.type.startsWith("audio/"));
		if (!files.length) return;

		for (const file of files) {
			const wasEmpty = Queue.length === 0;
			const idx = Queue.add(file);
			if (wasEmpty) {
				Queue.setCursor(idx);
				await loadAndPlay(file);
			}
		}
		refreshQueuePanel();
	});

    ui.btnPlay.addEventListener("click", async () => {
      await AudioEngine.playPause();
      if (state.audio.transportError) audioStatusToast(state.audio.transportError, 6000);
    });
    ui.btnStop.addEventListener("click", () => { AudioEngine.stop(); state.audio.transportError = ""; });

    function pickManualPrevFile() {
      if (Queue.canPrev()) return Queue.prev();
      if (preferences.audio.repeatMode === "all" && Queue.length > 1) return Queue.goTo(Queue.length - 1);
      return null;
    }

    function pickManualNextFile() {
      if (Queue.canNext()) return Queue.next();
      if (preferences.audio.repeatMode === "all" && Queue.length > 1) return Queue.goTo(0);
      return null;
    }

    ui.btnPrev.addEventListener("click", async () => {
      const file = pickManualPrevFile();
      if (file) await loadAndPlay(file);
    });
    ui.btnNext.addEventListener("click", async () => {
      const file = pickManualNextFile();
      if (file) await loadAndPlay(file);
    });

    ui.btnToggleQueue.addEventListener("click", () => {
      const visible = ui.queuePanel.style.display !== "none";
      ui.queuePanel.style.display = visible ? "none" : "block";
      if (!visible) refreshQueuePanel(); // refresh on open
    });

    ui.btnClearQueue.addEventListener("click", () => {
      // 3.4 — Clear queue clean-slate path. Order matters:
      // Queue.clear() first so Prev/Next disable correctly in next refreshAllUiText.
      // AudioEngine.unload() before clearAudioState() so no media remains attached.
      Queue.clear();
      AudioEngine.unload();
      clearAudioState(); // sets isLoaded/isPlaying/filename, resets scrubber + trails
      RecorderEngine.onTransportMutation("audio-unloaded", {
        reason: "queue-cleared",
      });
      refreshQueuePanel();
    });

    ui.btnRepeat.addEventListener("click", () => {
      const mode = preferences.audio.repeatMode;
      preferences.audio.repeatMode = mode === "none" ? "one" : (mode === "one" ? "all" : "none");
      applyPrefs("repeat");
    });
    if (ui.btnShuffle) {
      ui.btnShuffle.addEventListener("click", () => {
        if (Queue.shuffle()) refreshQueuePanel();
      });
    }
    ui.chkMute.addEventListener("change", () => { preferences.audio.muted = !!ui.chkMute.checked; applyPrefs("mute"); });

    ui.rngVol.addEventListener("input", () => {
      preferences.audio.volume = Number(ui.rngVol.value);
      applyPrefs("volume (playback only)");
    });

    ui.btnHideAudio.addEventListener("click", hideAudioPanel);
    ui.btnOpenAudio.addEventListener("click", showAudioPanel);

    ui.btnHideSim.addEventListener("click", hideSimPanel);
    ui.btnOpenSim.addEventListener("click", showSimPanel);

    ui.btnHideBands.addEventListener("click", hideBandsPanel);
    ui.btnOpenBands.addEventListener("click", showBandsPanel);

    ui.btnShare.addEventListener("click", shareLink);
    ui.btnApplyUrl.addEventListener("click", applyUrlNow);
    ui.btnResetPrefs.addEventListener("click", resetPrefs);
    ui.btnResetVisuals.addEventListener("click", () => { resetOrbsToDesignedPhases(); simStatusToast("Visuals reset."); });

    ui.chkLines.addEventListener("change", () => { preferences.trace.lines = !!ui.chkLines.checked; applyPrefs("lines"); });
    ui.rngNumLines.addEventListener("input", () => { preferences.trace.numLines = Number(ui.rngNumLines.value); applyPrefs("num lines"); });

    ui.selLineColorMode.addEventListener("change", () => {
      preferences.trace.lineColorMode = ui.selLineColorMode.value;
      applyPrefs("line color mode");
    });

    ui.rngEmit.addEventListener("input", () => { preferences.particles.emitPerSecond = Number(ui.rngEmit.value); applyPrefs("emit rate"); });
    ui.rngSizeMax.addEventListener("input", () => { preferences.particles.sizeMaxPx = Number(ui.rngSizeMax.value); applyPrefs("size max"); });
    ui.rngSizeMin.addEventListener("input", () => { preferences.particles.sizeMinPx = Number(ui.rngSizeMin.value); applyPrefs("size min"); });
    ui.rngSizeToMin.addEventListener("input", () => { preferences.particles.sizeToMinSec = Number(ui.rngSizeToMin.value); applyPrefs("time to min"); });
    ui.rngTTL.addEventListener("input", () => { preferences.particles.ttlSec = Number(ui.rngTTL.value); applyPrefs("ttl"); });
    ui.rngOverlap.addEventListener("input", () => { preferences.particles.overlapRadiusPx = Number(ui.rngOverlap.value); applyPrefs("overlap radius"); });

    ui.rngOmega.addEventListener("input", () => { preferences.motion.angularSpeedRadPerSec = Number(ui.rngOmega.value); applyPrefs("angular speed"); });
    ui.rngWfDisp.addEventListener("input", () => { preferences.motion.waveformRadialDisplaceFrac = Number(ui.rngWfDisp.value); applyPrefs("orb waveform disp"); });

    ui.rngRmsGain.addEventListener("input", () => { preferences.audio.rmsGain = Number(ui.rngRmsGain.value); applyPrefs("rms gain (analysis)"); });
    ui.rngMinRad.addEventListener("input", () => { preferences.audio.minRadiusFrac = Number(ui.rngMinRad.value); applyPrefs("min radius"); });
    ui.rngMaxRad.addEventListener("input", () => { preferences.audio.maxRadiusFrac = Number(ui.rngMaxRad.value); applyPrefs("max radius"); });
    ui.rngSmooth.addEventListener("input", () => { preferences.audio.smoothingTimeConstant = Number(ui.rngSmooth.value); applyPrefs("smoothing"); });
    ui.selFFT.addEventListener("change", () => { preferences.audio.fftSize = Number(ui.selFFT.value); applyPrefs("fft size"); });

    ui.clrBg.addEventListener("input", () => { preferences.visuals.backgroundColor = ui.clrBg.value; applyPrefs("background"); });
    ui.clrParticle.addEventListener("input", () => { preferences.visuals.particleColor = ui.clrParticle.value; applyPrefs("particle color"); });

    ui.selParticleColorSrc.addEventListener("change", () => {
      preferences.bands.particleColorSource = ui.selParticleColorSrc.value;
      applyPrefs("particle color source");
    });

    ui.chkBandOverlay.addEventListener("change", () => { preferences.bands.overlay.enabled = !!ui.chkBandOverlay.checked; applyPrefs("band overlay"); });
    ui.chkBandConnect.addEventListener("change", () => { preferences.bands.overlay.connectAdjacent = !!ui.chkBandConnect.checked; applyPrefs("band connect"); });

    ui.rngBandAlpha.addEventListener("input", () => { preferences.bands.overlay.alpha = Number(ui.rngBandAlpha.value); applyPrefs("overlay alpha"); });
    ui.rngBandPoint.addEventListener("input", () => { preferences.bands.overlay.pointSizePx = Number(ui.rngBandPoint.value); applyPrefs("overlay point size"); });
    ui.rngBandOverlayMinRad.addEventListener("input", () => { preferences.bands.overlay.minRadiusFrac = Number(ui.rngBandOverlayMinRad.value); applyPrefs("overlay min radius"); });
    ui.rngBandOverlayMaxRad.addEventListener("input", () => { preferences.bands.overlay.maxRadiusFrac = Number(ui.rngBandOverlayMaxRad.value); applyPrefs("overlay max radius"); });
    ui.rngBandOverlayWfDisp.addEventListener("input", () => { preferences.bands.overlay.waveformRadialDisplaceFrac = Number(ui.rngBandOverlayWfDisp.value); applyPrefs("overlay waveform disp"); });

    ui.selRingPhaseMode.addEventListener("change", () => {
      preferences.bands.overlay.phaseMode = ui.selRingPhaseMode.value;
      applyPrefs("ring phase mode");
    });

    ui.selDistMode.addEventListener("change", () => {
      preferences.bands.distributionMode = ui.selDistMode.value;
      applyPrefs("band distribution mode", { rebuildBandsOnDefinitionChange: true });
    });

    ui.rngRingSpeed.addEventListener("input", () => {
      preferences.bands.overlay.ringSpeedRadPerSec = Number(ui.rngRingSpeed.value);
      applyPrefs("ring speed");
    });

    ui.rngHueOff.addEventListener("input", () => { preferences.bands.rainbow.hueOffsetDeg = Number(ui.rngHueOff.value); applyPrefs("hue offset"); });
    ui.rngSat.addEventListener("input", () => { preferences.bands.rainbow.saturation = Number(ui.rngSat.value); applyPrefs("saturation"); });
    ui.rngVal.addEventListener("input", () => { preferences.bands.rainbow.value = Number(ui.rngVal.value); applyPrefs("value"); });

    /* Drag-drop onto canvas — multi-file entry point.
       All dropped audio files are enqueued. If the queue was empty before the
       drop, the first file starts playing immediately. Additional files append
       silently. Non-audio files are silently ignored. */
    state.canvas.addEventListener("dragover", (e) => {
      e.preventDefault(); // required to allow drop
      e.dataTransfer.dropEffect = "copy";
    });
    state.canvas.addEventListener("drop", async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("audio/"));
      if (!files.length) return;
      for (const file of files) {
        const wasEmpty = Queue.length === 0;
        const idx = Queue.add(file);
        if (wasEmpty) {
          Queue.setCursor(idx);
          await loadAndPlay(file);
        }
      }
      refreshQueuePanel();
    });

    // Safety net: dropping files outside the canvas should never navigate away.
    // Canvas keeps ownership of the actual queue add/load behavior above.
    window.addEventListener("dragover", (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) e.preventDefault();
    });
    window.addEventListener("drop", (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) e.preventDefault();
    });

    function hasFocusedInteractiveTarget(event) {
      const target = event.target;
      if (!(target instanceof Element)) return false;
      if (target.closest('input, select, textarea, button, [contenteditable="true"], [role="button"]')) return true;
      return false;
    }

    // Global shortcuts are intentionally suppressed while a control has focus,
    // so typing/adjusting controls never triggers transport/panel side effects.
    window.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (hasFocusedInteractiveTarget(e)) return;

      if (e.code === "KeyH") {
        togglePanels();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        state.time.simPaused = !state.time.simPaused;
        return;
      }
      if (e.code === "KeyR") {
        resetOrbsToDesignedPhases();
        return;
      }

      // Track navigation — N: next, P: prev (Repeat=All wraps at boundaries).
      if (e.code === "KeyN") {
        const file = pickManualNextFile();
        if (file) loadAndPlay(file);
        return;
      }
      if (e.code === "KeyP") {
        const file = pickManualPrevFile();
        if (file) loadAndPlay(file);
        return;
      }

      // Seek — arrow keys ±5 seconds, Shift+arrows ±30 seconds.
      // preventDefault stops page scroll.
      if (e.code === "ArrowRight" || e.code === "ArrowLeft") {
        e.preventDefault();
        const el = AudioEngine.getMediaEl();
        if (el && Number.isFinite(el.duration)) {
          const step = e.shiftKey ? 30 : 5;
          const delta = (e.code === "ArrowRight" ? step : -step);
          el.currentTime = clamp(el.currentTime + delta, 0, el.duration);
        }
      }
    }, { passive: false });

    window.addEventListener("hashchange", () => {
      const ok = UrlPreset.applyFromLocationHash();
      if (ok) {
        applyPrefs("hash preset loaded", { rebuildBandsOnDefinitionChange: true });
        initOrbs();
        resetOrbsToDesignedPhases();
      }
    });

  } // end wireControls

  return {
    setCssVarsFromConfig,
    wireControls,
    refreshAllUiText,
    refreshRecordingUi,
    getRecordingUiModel,
    showRecordPanel,
    hideRecordPanel,
    dispatchRecordingAction,
    applyPrefs,
  };
})();

export { UI };
