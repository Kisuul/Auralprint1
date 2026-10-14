import { CONFIG } from "../core/config.js";
import { interpretWaveformMetadata } from "./waveform-metadata.js";

const positiveWhole = value => Number.isSafeInteger(value) && value > 0;
function profileBytes(policy, profile) {
  // Stereo reference workload; not the unknown-channel fallback or duration cap.
  return profile.approximateMinutes * 60 * policy.decodeSampleRateHz * 2 * Float32Array.BYTES_PER_ELEMENT;
}
function validateWaveformPolicy(policy) {
  const bad = { ok: false, reason: "invalid-policy" };
  if (!policy || !positiveWhole(policy.decodeSampleRateHz) || !positiveWhole(policy.peakBucketCount)
    || !positiveWhole(policy.fallbackEstimatedChannels)
    || !Number.isSafeInteger(policy.maxEncodedBytes) || policy.maxEncodedBytes < 0
    || !Number.isSafeInteger(policy.maxEstimatedDecodedPcmBytes) || policy.maxEstimatedDecodedPcmBytes < 0
    || !positiveWhole(policy.metadataProbe?.maxBytes) || policy.metadataProbe.maxBytes < 12
    || !positiveWhole(policy.metadataProbe?.maxChunks)
    || !Array.isArray(policy.automaticProfiles) || !policy.automaticProfiles.length) return bad;
  const ids = new Set();
  for (const profile of policy.automaticProfiles) {
    if (!profile || typeof profile.id !== "string" || !profile.id.trim() || profile.id !== profile.id.trim()
      || ids.has(profile.id) || !positiveWhole(profile.approximateMinutes)
      || !positiveWhole(profileBytes(policy, profile))) return bad;
    ids.add(profile.id);
  }
  if (!ids.has(policy.defaultProfileId)) return bad;
  return { ok: true, reason: "valid-policy" };
}
function resolveWaveformProfile(policy, selectedProfileId) {
  if (!validateWaveformPolicy(policy).ok) return null;
  const selected = policy.automaticProfiles.find(p => p.id === selectedProfileId);
  const profile = selected || policy.automaticProfiles.find(p => p.id === policy.defaultProfileId);
  return { ...profile, pcmBytes: profileBytes(policy, profile), usedDefault: !selected };
}
function evaluateWaveformPolicy(input, policy = CONFIG.waveform) {
  const refuse = (reason, extra = {}) => ({ decision: "refuse", reason, ...extra });
  if (!validateWaveformPolicy(policy).ok) return refuse("invalid-policy");
  if (!input || !Number.isSafeInteger(input.fileSizeBytes) || input.fileSizeBytes <= 0) return refuse("invalid-file-size");
  // Cheap encoded admission precedes even metadata access; this pure function
  // starts no read/decode and consumes no coordinator occupancy.
  if (input.fileSizeBytes > policy.maxEncodedBytes) return refuse("encoded-budget");
  const requestKind = input.requestKind ?? "automatic";
  if (!["automatic", "manual"].includes(requestKind)) return refuse("invalid-request");
  const profile = resolveWaveformProfile(policy, input.selectedProfileId);
  const metadata = interpretWaveformMetadata(input, policy);
  const common = { profileId: profile.id, profilePcmBytes: profile.pcmBytes, metadata };
  if (metadata.confidence === "unknown") return { decision: metadata.reason === "metadata-pending" ? "defer" : "refuse", reason: metadata.reason, ...common };
  if (metadata.confidence === "invalid") return refuse(metadata.detail === "unsafe-pcm-arithmetic" ? "pcm-budget" : "metadata-unavailable", common);
  const estimatedPcmBytes = metadata.estimatedPcmBytes;
  const cost = { ...common, estimatedPcmBytes };
  if (estimatedPcmBytes > policy.maxEstimatedDecodedPcmBytes) return refuse("pcm-budget", cost);
  if (requestKind === "automatic" && estimatedPcmBytes > profile.pcmBytes) return { decision: "offer", reason: "above-auto-profile", ...cost };
  return { decision: "admit", reason: "within-budget", ...cost };
}

export { validateWaveformPolicy, resolveWaveformProfile, evaluateWaveformPolicy };
