# Candidate factory settings — not approved defaults

**Provisional desktop interactive candidates only.** No universal physical-memory,
device, bitrate or recording-duration guarantee. Human approval and subsequent
implementation acceptance are required. Build 115N remains WITHHELD.

## Derivation before UI rounding

The five-minute standard workload produced 97,086,560 bytes in 300.058s:
323,559.312 bytes/s, the highest average among the tested standard-tier trials.
An interactive five-minute planning horizon at that observed rate is 97.068 MB.
A **chosen 25% planning margin** gives 121.335 MB, then rounding upward to an
understandable decimal 10 MB setting gives **S=130 MB**. The margin is an explicit
engineering proposal, not a measured confidence bound or enforced bitrate maximum.
Short baseline/standard File/Stream/VP8/MP4 observations and the longer VP9 trial
support a bounded desktop policy comparison; no stationarity guarantee follows.

The largest delivered event M was 2,079,150 bytes (standard MP4). Maximum total
post-Stop delivery F was 693,980 bytes (reproduced A MP4). Both can consume headroom:
starting just below S, the admitted crossing event overshoots before Stop is
requested, then final native delivery arrives. A chosen 3× margin on M+F gives
8,319,390 bytes, rounded upward in 5 MB increments to **R=10 MB**. R covers neither
arbitrary delayed native delivery nor a proven final-event maximum.

Allow two nominal S-sized outputs (old plus new) and that reserve:
**H=2S+R=270 MB**. This is a logical-payload policy relationship, not a measured
maximum safe RAM allocation. The largest native old+new overlap actually observed
was 98.051 MB, well below H. Near-H resource survival was NOT tested; modeled
admission does not supply that physical evidence.

The five-minute run delivered 294 nonempty events. A chosen fourfold tolerance
plus two event slots yields 1,178 references, rounded upward to **C=1,200**.
This bounds retained reference cardinality, not Blob object-memory cost. No
per-reference native/heap allocation measurement justifies calling C a RAM cap.

## Proposed Balanced settings

All finite fields would belong to immutable CONFIG with canonical validated
application-policy settings. They are not installed by N.2.

| Quantity | Candidate exact setting | Display equivalent | Supporting observation / unresolved risk |
| --- | ---: | --- | --- |
| S: new-session soft Stop | 130,000,000 bytes | 130 MB = 123.98 MiB | Five-minute standard payload plus 25% rate margin and upward rounding. Higher/delayed output may cross much earlier; no native S crossing tested. |
| H: aggregate P+D admission | 270,000,000 bytes | 270 MB = 257.49 MiB | 2S+R, preserves one old export plus a new nominal session. Largest actual overlap only 98.051 MB; no physical safety certification at H. |
| R: intended final-delivery headroom | 10,000,000 bytes | 10 MB = 9.54 MiB | 3× observed crossing+post-Stop total, rounded upward. 16× observed tail fails sensitivity; R is not a native bound. |
| C: nonempty chunk references | 1,200 | 1,200 chunks | About 4× the five-minute observed count. Small rapid events may exhaust it even with low bytes. Metadata costs unknown. |
| T: optional automatic elapsed Stop | 300,000ms | 5 minutes | Longest completed extended trial, consistent with bounded interactive goal. Optional product choice; not a universal maximum or exact suspended-page deadline. |
| Warning | 80% of effective S, H including P, C and enabled T | One nonblocking warning per category/session plus progress | UI planning proposal, not a statistical risk percentile. A single event can jump over warning and hard admission. |

Use explicit units. If the UI chooses MiB inputs, preserve exact CONFIG bytes and
show decimal MB / exact bytes in Details; do not silently reinterpret 130 MB as
130 MiB. Display sensible rounded progress, retain exact integers for admission.
The defaults need not be powers of two; their workload relationship matters.

With these candidates `S_effective = min(130 MB, 260 MB - P)`. With P=97,086,560
bytes the threshold remains 130 MB. If P=150 MB it falls to 110 MB. If P≥260 MB,
no reserve-preserving new Start is admitted; P remains downloadable even if it
already exceeds H. Capacity Stop follows an admitted crossing, so output can exceed
S and a previous export can itself be larger than S. Reserve cannot guarantee a
crossing-plus-final pair fits. Every event must independently satisfy H and C.

## Ranges for review and sensitivity

| Choice under review | Candidate range | Evidence needed to choose confidently |
| --- | --- | --- |
| S | 100–160 MB | Repeated physical baseline/standard five-minute runs by codec and memory class. At 100 MB the observed 97 MB leaves little margin; 160 MB has no measured safety advantage on weak hardware. |
| H | 2S+R, roughly 210–330 MB for R=10 MB | Near-threshold old/new captures on target devices, assembly/URL/cleanup observation, process/native metrics with scope. Never delete P to make room. |
| R | 5–20 MB | Repeated tail/burst observations, long MP4, backgrounds/suspension and early Stop near an admitted crossing. Sensitivity challenges 1×/2×/4×/8×/16× F and delivery delays. |
| C | 600–2,400 | Actual event cadence distributions across browsers/containers, object/reference overhead and count-bound failure/recovery tests. |
| T | 5 minutes or explicitly disabled; other Custom values if approved | Human bounded-use choice and more safe long-duration trials. Fifteen minutes was not measured. No universal duration is invented. |

At P=S and D=S−1, the largest observed crossing plus an invented 8× observed
post-Stop tail totals 267,630,989 bytes, fitting H. A 16× tail totals 273,182,829
and is rejected. At the observed standard average rate, an invented 15s delayed
tail fits; 30s does not. These are arithmetic stress schedules, not native
observations or guaranteed tolerable pauses. See sensitivity.json for varied
S/R/H/C/T outcomes and policy-replay.json for every saved workload ledger.

A single tail may already have been allocated by the browser before rejection.
Assembly can fail even below H. The summed-RSS diagnostic guard was reached in
a high-resolution VP8 trial with only 3.55 MB output: encoded payload does not
bound renderer/encoder/GPU/process resource cost. Do not promise these candidates
make arbitrary hardware safe.

## Custom and Unrestricted

Custom should expose enabled limits under the Settings contract, validate their
relationships, and snapshot on next Start. Optional per-control disabling is an
explicit product decision; H-only may fail instead of completing early, and R is
inactive when H is off. Headroom is derived by default and only expert-editable if
approved. Choices persist independently of Scene presets and schema 10.

Unrestricted explicitly disables application S/H/C/T. No default-valued fallback,
alternative byte/reference governor, silent duration stop or disguised numeric
ceiling is permitted. Keep nonblocking representable measurement, mandatory safe
integer/invalid-state checks, session and callback fences, cleanup/error settlement
and previous-export ownership. Browser/OS/storage/JavaScript representation limits
are real; technical allocation/accounting errors must be truthful. No current
unsaved-capture survival promise on process/page crash. The proposed architecture
can express Unrestricted using disabled optional policy fields; there is no
identified architectural need for a hidden numeric policy ceiling.

The remaining human choices and acceptance evidence are in acceptance-matrix.md.
These candidates are review inputs, not release approval or permission to begin N.3.
