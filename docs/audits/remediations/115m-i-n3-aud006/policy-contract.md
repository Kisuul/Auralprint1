# Approved recorder resource policy

All sizes are decimal bytes. These provisional desktop factory choices follow the
owner's N.3 decision and N.2 calibration; they are not universal memory ceilings,
encoder rates or supported-device certifications.

| Symbol | CONFIG field | Balanced value |
| --- | --- | ---: |
| S | softBytes | 130,000,000 bytes |
| H | aggregateBytes | 270,000,000 bytes |
| R | reserveBytes | 10,000,000 bytes |
| C | maxChunks | 1,200 nonempty retained references |
| T | durationMs | 300,000 ms |
| W | warningFraction | 0.80 |

Balanced enables every value. Custom independently supports S/H/C/T Off (null)
and optional 80% warnings. Enabled limits are positive safe integers in canonical
units. Custom reserve is min(factory R, floor(H/10)), at least one byte; H must
leave positive payload and enabled S must fit H-R. No expert reserve override.
H Off makes R inactive. S Off with H On can fail hard admission rather than finish
early. Unrestricted sets S/H/R/C/T and warnings to null, with no alternative caps.
Technical representation/lifecycle/ownership/integrity checks always remain.

At Start P is the retained successful export's byte size. Refuse H-P<=R or P>=H,
without native acquisition, chunk reset or export eviction. For enabled S/H:
`S_effective=min(S,H-P-R)`. With H Off use S alone; with S Off there is no soft
completion threshold. Frozen policy snapshots apply until terminal settlement.

Every event: token → valid nonnegative safe byte size → checked delivered/admitted
sums and next count → P+D+E<=H if H On → next count<=C if C On → retain whole event.
Empty events retain nothing. Rejected events never enter pending storage; hard
rejection aborts the entire new capture, never creates a truncated download. Data
already delivered by the browser may already have native allocation. Chunks are
not copied for accounting. Separately retained diagnostics survive pending cleanup.

After admission evaluate capacity and monotonic elapsed time together: capacity is
primary and duration secondary when both cross in one check. Earlier independently
requested reasons remain primary. Timer/data/public Stop boundaries use the clock,
not RAF/frame counts. Native Stop is latched once before call. An admitted final
tail may exceed S; it must still fit H/C. R is intended headroom, not a final-event
guarantee. Warnings latch per category and never block capture.

Five minutes is a configured automatic-Stop target. Timer throttling/suspension can
delay action and native finalization adds time. Owner-supplied catalog statistics
(approximately 92%/95% below 5:01) informed the product choice; they are not recording
session measurements or proven coverage for an exact 300-second cutoff. Users can
select longer Custom sessions or opt into Unrestricted. Native browser/device limits
and unsaved-capture loss on process/page crash remain possible.
