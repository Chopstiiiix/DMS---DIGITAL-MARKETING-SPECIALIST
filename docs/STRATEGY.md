# Spin Music: Spinner growth strategy

Snapshot of the working strategy doc as of 5 October 2026. The live version is
a Claude doc Malcolm edits:
https://claude.ai/code/artifact/2325474a-6d4d-4fc0-83af-d135c335068e
If the two differ, the live doc wins.

## Positioning

Spin is where Spinners, the independent artists on the platform, earn directly
from the people listening, live. This is the Spinner-side message; listener
messaging comes later.

| Element | Statement |
| --- | --- |
| Who | Independent artists without a label or a large existing audience. On Spin they are Spinners. |
| Pain | Streaming pays fractions of a penny, and social reach does not convert into income |
| Promise | Play it live and earn directly from the people listening |
| Proof | Keep 70% of track sales and 90% of tips; sell tickets to live events; 24-hour rentals; top artists and producers already on Spin |
| Founder edge | Built by a Grammy-winning producer who has been on the artist side of the deal |

One-line version for bios and ads, set by Malcolm:
**"Sell directly to listeners. Get paid. Grow your audience."**

The pain and promise lines are proposed wording, not tested. The first job of
the content engine is to test them against alternatives, including a variant
that carries the 70% and 90% figures.

## Persona

One persona on the supply side: the Spinner. Spinners are the artists; they
upload their own tracks and run a live station. Listeners are the other side
and come later.

| | Spinner |
| --- | --- |
| Who | Independent artist who uploads their own tracks and runs a live station |
| Wants | Income per fan, ownership, an audience, a direct line to listeners |
| Fears | Another platform that takes the music and pays nothing; going live to an empty room |
| Message | Your own live station. Keep 70% of every sale and 90% of tips. |
| Activates when | First track uploaded or first broadcast completed |
| Found on | Instagram, TikTok, X, and artist, producer and DJ communities (an assumption to validate in the first four weeks of tracking) |

## Funnel and north-star metric

North star: **activated Spinners per week**: accounts that upload a first
track or complete a first broadcast within 7 days of signing up. The 7-day
window is an open question to Malcolm.

| # | Stage | Definition | Measured by |
| --- | --- | --- | --- |
| 1 | Reach | Saw a Spin post, message or mention | Platform analytics |
| 2 | Click | Tapped a Spin link | DMS short-link logger |
| 3 | Install | Downloaded the iOS app (optional; web sign-up skips this) | App Store Connect, by campaign token |
| 4 | Signup | Created a Spinner account | Spin database |
| 5 | Activation | First upload or first broadcast within 7 days | Spin database |
| 6 | Retention | Active again in weeks 2 to 4 | Spin database |
| 7 | Revenue | First sale, tip or ticket earned | Spin database |
| 8 | Referral | Brought in another Spinner | Invite code |

Each week the platform reports the conversion rate between every pair of
stages. The lowest rate is that week's priority. No targets yet: the first two
weeks of tracking set the baseline.

## Organic channel plan

Start with three channels, not seven.

| Priority | Channel | Type | What we do | Owner |
| --- | --- | --- | --- | --- |
| 1 | Direct Spinner outreach | Owned | Personal email and DM to shortlisted artists, with a tracked invite link | Malcolm |
| 2 | Short video | Owned | Existing video assets first, posted on Instagram; founder-led pieces when available | Malcolm |
| 3 | Spin brand social | Owned | On Instagram (@spinmusicworld): Spinner spotlights, earnings proof, live-show clips, how-to posts | Platform drafts, Malcolm approves |
| 4 | Activation email | Owned | Nudges from sign-up to first upload or first broadcast | Platform, automated |
| 5 | Partner: Indvstry Exchange | Borrowed | London-based partner. Joint music business mentorship programme in Kenya in December; Spin hosted its track submission page | Malcolm |
| 6 | Spinner referrals | Earned | Every activated Spinner gets an invite code to share | Platform, automated |
| Later | Paid ads | Paid | Amplify the posts and messages that already convert | When budget exists |

Channels 1 to 3 start in the first month. Channels 4 to 6 switch on as the
platform modules ship. Channel 5 is tied to the December programme, the first
campaign with a fixed date.

Spinner links go to web sign-up at spinmusic.uk first; the iOS app is the
follow-up, not the entry point. That also covers Android, where there is no
app yet.

## Content pillars

| Pillar | Job | Example post |
| --- | --- | --- |
| Money math | Make the payout difference concrete | "What 1,000 fans are worth on Spin" breakdown |
| Spinner spotlight | Social proof from real Spinners | A clip from a live show with the Spinner's own words |
| How it works | Remove friction before sign-up | 30-second walk-through: upload a track, go live |
| Founder voice | Trust and reach through Malcolm's story | Lessons from the producer side of the industry |
| Live moments | Show the product is alive | Highlights from concerts, jams and broadcasts |

Proposed starting mix: two videos from the existing assets and five brand
posts a week, each carrying a tracked link. Founder-led pieces when available,
not on a fixed schedule. The mix changes once two weeks of data show which
pillar drives activations.

Money-math posts use only figures Spin can stand behind: the published revenue
splits and real Spinner earnings shared with permission. Featuring an existing
Spinner by name needs their agreement first.

## Tracking plan

1. **Create the link.** One short link per post, message or partner, tagged with channel, campaign and pillar.
2. **Log the click.** The redirect records time, country, device and referrer.
3. **Hand off to sign-up.** Spinner links go to web sign-up with the campaign tag attached. App Store links carry an Apple campaign token instead.
4. **Capture the source at sign-up.** The click id, plus a "How did you hear about us?" question for people who arrive without one.
5. **Read activation from Spin.** A read-only feed of sign-up, first upload, first broadcast and first earning.
6. **Join it on the dashboard.** Channel and campaign down the side, funnel stages across the top.

Limits to expect:

- Apple shows a campaign only after first-time downloads from at least 5 people, and at least 24 hours after launch.
- Step 4 needs a small change to Spin's sign-up, which stores no campaign tag today. Without it, attribution stops at the click.
- Someone who sees a post and later searches the App Store counts as organic.
- Apple campaign tokens hold up to 30 characters.

## Answers Malcolm gave

- Spinners are the artists; listeners are listeners. One sign-up flow.
- Instagram `@spinmusicworld` is the only social account, and it is a professional account.
- Founder-led video is occasional, not a fixed commitment. He has existing video assets to post.
- A few top artists and top music producers are already on Spin.
- Indvstry Exchange is the one solid partner relationship.
- Android is not available: Google Play is blocked on a D-U-N-S number.
- Read-only database access for DMS: approved, through a dedicated role limited to a few reporting views.
