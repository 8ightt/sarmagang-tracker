# EA Pro Clubs API: every field

<!-- generated from docs/ea-data.json by scripts/ea-docs.mjs; edit the JSON, not this file -->

Everything EA's Pro Clubs API sends, what it means, how sure we are, and where the site uses it. Last checked 2026-10-11.

- **Base URL:** `https://proclubs.ea.com/api/fc`, no login. Every call needs ?platform=common-gen5 (current gen) or common-gen4.
- **Bot filter:** EA rejects clients whose TLS fingerprint doesn't match a browser; scripts/fetch-ea.py uses curl_cffi with impersonate='chrome'.
- **Caching:** EA's edge caches identical URLs for minutes; add a unique query param (e.g. _=timestamp).
- **Values:** almost every number arrives as a string ("54", not 54).
- **Not available:** matches older than the last 10 per match type; minute-by-minute events, goal times, xG, heatmaps; season totals per archetype (only the in-game Archetypes > Statistics screen has them); Rush, Live Tournament and Drop In matches (empty for this club); pro attributes (vproattr is 'NH').
- **Endpoints that don't exist:** tried 2026-10-11, all HTTP 404: clubs/search, seasonRankLeaderboard, clubs/seasonalStats, clubs/playoffAchievements, members/archetypes, members/archetype/stats, members/stats/archetypes, members/seasonal/stats.

**How sure:** ✅ verified: Checked against real data; safe to build on. · 🟡 assumed: Meaning follows from the name or a few examples, not proven. · ❓ unknown: Seen in the data, meaning not worked out. · ⛔ useless: Always the same value, or contradicts other fields.

## Endpoints

- [`clubs/matches`](#clubsmatches): The club's last 10 games of one type, newest first.
- [`clubs/info`](#clubsinfo): A club's name, region, crest, kits and stadium.
- [`clubs/overallStats`](#clubsoverallstats): The club's season record, streaks, Skill Rating and reputation.
- [`allTimeLeaderboard/search`](#alltimeleaderboardsearch): Clubs whose name matches, with their record and division.
- [`allTimeLeaderboard`](#alltimeleaderboard): The top 100 clubs on the platform by Skill Rating (2441 down to 2132 on 2026-10-11).
- [`members/stats`](#membersstats): Every member's season totals at this club.
- [`members/career/stats`](#memberscareerstats): Every member's all-time totals at this club, with fewer fields than members/stats.

## clubs/matches

`GET https://proclubs.ea.com/api/fc/clubs/matches?platform=common-gen5&clubIds=<one id>&matchType=leagueMatch|playoffMatch|friendlyMatch&maxResultCount=10`

The club's last 10 games of one type, newest first. Each game has both clubs, every human player's line and a total per club. Promotion match games come as leagueMatch. The site saves every game from here (matches.raw), because EA drops them after 10.

### The game

Path: `[]`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `matchId` | ✅ verified | unique match id | matches.id, /matches/<id> |
| `timestamp` | ✅ verified | kick-off, unix seconds | matches.ts |
| `timeAgo.number`, `timeAgo.unit` | ✅ verified | how long ago, relative to the request (e.g. 2 hours); not stored |  |

### Each club in the game

Path: `[].clubs.{id}`. Keyed by club id: ours (837026) and the opponent's.

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `goals` | ✅ verified | goals scored (same as score) | matches.goals_for / goals_against |
| `goalsAgainst` | ✅ verified | goals conceded |  |
| `score` | ✅ verified | same as goals |  |
| `result` | ✅ verified | outcome code Codes: `1` win, `2` loss, `4` draw, `10` loss after quitting, `16385` win, opponent quit. *Evidence:* all 17 saved matches | matches.result, matches.dnf |
| `winnerByDnf` | ✅ verified | 1 = won because the other club quit |  |
| `wins` | ✅ verified | 1 if this club won this game |  |
| `losses` | ✅ verified | 1 if this club lost this game |  |
| `ties` | ✅ verified | 1 if it was a draw |  |
| `date` | ✅ verified | same as timestamp (within 2 s) |  |
| `matchType` | 🟡 assumed | 1 = league match *Note:* verified 2026-10-11: promotion series games (Lier City, Division 4 → 3) come from the leagueMatch endpoint with matchType 1, so the site tells them apart only by replaying the season (points target reached) *Evidence:* only league matches seen |  |
| `TEAM` | 🟡 assumed | the club's crest at the time of the game: the custom crest's asset id (99xxxxxx), or the base team id for clubs using a real team's crest *Evidence:* ours was 99070108 for 13 games, then 99160622 for the last 3, which is our current crestAssetId; opponents' values match their crestAssetId or teamId |  |
| `gameNumber` | ⛔ useless | always 0 |  |
| `season_id` | ⛔ useless | always 0 |  |

### Club details

Path: `[].clubs.{id}.details`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `name` | ✅ verified | club name | matches.opp_name |
| `clubId` | ✅ verified | club id |  |
| `regionId` | ✅ verified | region as ASCII text in hex: 5719381 = 0x574555 = "WEU" (Western Europe); a trailing digit can mark a sub-region *Source:* frdceri/clubs-hub lib/lookups.js (see thanks) |  |
| `teamId` | ❓ unknown | probably the base team the club was created from |  |

### Club kits, crest and stadium

Path: `[].clubs.{id}.details.customKit`. Colours are RGB as a decimal number: 11786 = #002E0A.

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `crestAssetId` | ✅ verified | crest image id | crests everywhere (lib/ea-assets.ts crestUrl), matches.opp_crest |
| `crestColor` | 🟡 assumed | crest background colour |  |
| `stadName` | ✅ verified | stadium name; default clubs show 'Tier 1 Stadium' in their language | club page |
| `kitColor1-4` | ✅ verified | home kit colours (body, trim, sleeve, extra) | kit shirts on match pages (matches.our_kit / opp_kit) |
| `kitAColor1-4` | ✅ verified | away kit colours | club page kits |
| `kitThrdColor1-4` | ✅ verified | third kit colours | club page kits |
| `selectedKitType` | 🟡 assumed | which kit was worn: 0 home, 1 away, 2 third |  |
| `kitId`, `customKitId`, `customAwayKitId`, `customThirdKitId`, `customKeeperKitId` | ❓ unknown | kit design ids (pattern, template); no public image source |  |
| `seasonalTeamId`, `seasonalKitId` | ❓ unknown | seasonal kit ids; 0 for clubs without one |  |
| `dCustomKit` | ❓ unknown | 0, 1 or 3 |  |

### Each player's line

Path: `[].players.{id}.{id}`. Keyed by club id, then the player's EA account id. Only humans get a line: the CPU teammates' stats are added to whoever controls them.

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `playername` | ✅ verified | gamertag |  |
| `pos` | ✅ verified | broad group only: goalkeeper / defender / midfielder / forward | position on match pages (exact slot only via Fix stats) |
| `archetypeid` | ✅ verified | FC 27 archetype played, numbered in the game's order (keepers, defenders, midfielders, forwards) Codes: `1` Shot Stopper, `2` Sweeper Keeper, `3` Progressor, `4` Boss, `5` Marauder, `6` Disruptor, `7` Recycler, `8` Maestro, `9` Creator, `10` Spark, `11` Magician, `12` Finisher, `13` Target. *Evidence:* 1-2 only on keepers, 3-5 on defenders, 6-10 on midfielders, 11-13 on forwards; mo_nm's in-game Archetypes screen (2026-10-11) shows Target, Finisher and Sweeper Keeper, and his saved games are 13 and 2 *Confirmed:* 2026-10-11 by the club: dirty8ightt Creator (midfield) and Magician (up front), mo_nm Target *Source:* frdceri/clubs-hub lib/lookups.js (see thanks) | By archetype table and season-by-archetype cards on player pages |
| `rating` | ✅ verified | match rating; on the CPU controller's line it differs from the in-game RR *Note:* LA Seigue FC, 14 Oct: in-game RR = EA rating for 5 of 6 players, but dirty8ightt (running the CPU) 6.0 in game vs 6.7 from EA |  |
| `goals` | ✅ verified | EA's goals; on the line of whoever controls the CPU this INCLUDES the CPU teammates' goals | shown as 'EA: n incl. CPU'; own goals come from counter 214 |
| `assists` | ✅ verified | as goals: includes CPU assists on the controller's line |  |
| `shots` | ✅ verified | as goals: includes CPU shots on the controller's line |  |
| `passesmade` | ✅ verified | completed passes; includes CPU on the controller's line, and 0 for a player who quit | shown as 'EA: n incl. CPU'; own passes come from counter 215 |
| `passattempts` | ✅ verified | attempted passes; includes CPU on the controller's line |  |
| `tacklesmade` | ✅ verified | won tackles; includes CPU on the controller's line | shown as 'EA: n incl. CPU'; own tackles come from counter 164 |
| `tackleattempts` | ✅ verified | attempted tackles; includes CPU on the controller's line |  |
| `redcards` | ✅ verified | red cards; may include CPU cards on the controller's line | a red without counter 96 or 2+ yellows (95 + 213) is moved to the CPU automatically (corrections, created_by auto) |
| `mom` | ✅ verified | 1 = man of the match |  |
| `saves` | ✅ verified | saves (keepers) *Note:* can run above the in-game screen: mo_nm vs Angola fest (13 Oct) EA 11, in game 9 (11 shots on target, 2 conceded) |  |
| `reflexSaves`, `parrySaves`, `punchSaves`, `ballDiveSaves`, `crossSaves`, `goodDirectionSaves` | 🟡 assumed | saves by type; they add up to less than saves (mo_nm 16 of 21), the rest are untyped | Saves by type on player and match pages |
| `goalsconceded` | ✅ verified | goals conceded while this player was on the pitch | goals conceded, clean sheets |
| `cleansheetsdef` | 🟡 assumed | 1 = clean sheet as a defender *Evidence:* the only 1 seen is a defender in a 0-conceded game; forwards and midfielders in the same kind of game have 0 |  |
| `cleansheetsgk` | ❓ unknown | probably 1 = clean sheet as keeper; no keeper clean sheet saved yet |  |
| `cleansheetsany` | ❓ unknown | always 0 so far |  |
| `secondsPlayed` | ✅ verified | in-game seconds on the pitch (90 min ≈ 5400) | minutes, AFK detection |
| `gameTime` | ✅ verified | same as secondsPlayed |  |
| `realtimegame` | 🟡 assumed | real-world seconds in the match (~15-17 min for 90) *Note:* one outlier of 7052 s (EnEsC-37), maybe time in the lobby |  |
| `realtimeidle` | 🟡 assumed | real-world seconds idle | AFK flags |
| `wins`, `losses` | ✅ verified | mirror the club result for this player |  |
| `userResult` | 🟡 assumed | 6 = this player quit early, 0 otherwise *Evidence:* 6 on 5 lines, all in games our side lost by quitting (result 10); 0 everywhere else |  |
| `namespace` | 🟡 assumed | the player's platform account type: 1 = PlayStation, 3 = Xbox (crossplay) *Evidence:* 1 on all our PS5 players (104 lines); 3 only on 7 opponents |  |
| `SCORE` | ✅ verified | club score repeated |  |
| `vproattr` | ⛔ useless | always 'NH' (attributes hidden in FC 27) |  |
| `vprohackreason` | ⛔ useless | always 0 |  |
| `match_event_aggregate_0-3` | ✅ verified | hidden per-player event counters, see matchEventCounters | own goals, assists and shots (not the CPU's) |

### Club totals

Path: `[].aggregate.{id}`. Same fields as a player line, summed over the club's human players.

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| *every field* | ✅ verified | the club's player lines summed, including fields where a sum means nothing (rating, archetypeid); pos is 0 *Evidence:* rating and archetypeid equal the sums of the player lines on every saved game | team stats on match pages |

## clubs/info

`GET https://proclubs.ea.com/api/fc/clubs/info?platform=common-gen5&clubIds=<id>`

A club's name, region, crest, kits and stadium. Same fields as 'Club details' and 'Club kits' in a match.

### The club

Path: `{id}`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `name` | ✅ verified | club name | club page |
| `clubId` | ✅ verified | club id |  |
| `regionId` | ✅ verified | region, see clubs/matches |  |
| `teamId` | ❓ unknown | see clubs/matches |  |

### Kits, crest and stadium

Path: `{id}.customKit`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| *every field* | ✅ verified | same as customKit in clubs/matches | crest, kits and stadium on the club page |

## clubs/overallStats

`GET https://proclubs.ea.com/api/fc/clubs/overallStats?platform=common-gen5&clubIds=<one id>` (several ids return HTTP 400; works for any club)

The club's season record, streaks, Skill Rating and reputation.

### Club record

Path: `[]`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `clubId` | ✅ verified | club id |  |
| `gamesPlayed`, `wins`, `ties`, `losses`, `goals`, `goalsAgainst` | ✅ verified | season totals (league games) | club page tiles |
| `leagueAppearances` | ✅ verified | equals gamesPlayed so far |  |
| `gamesPlayedPlayoff` | 🟡 assumed | games in EA's playoff type; 0 so far (promotion games count as league) |  |
| `promotions`, `relegations` | ✅ verified | promotions and relegations; promotions went 2 → 3 in the first poll after the promotion to Division 3, so unlike the division fields this one is up to date | division ladder |
| `skillRating` | ✅ verified | Elo-style rating used for matchmaking; matches the in-game Season Info (1438 on 2026-10-11) | club page; matches.our_sr / opp_sr, saved when a game is first seen (opponents looked up for games under 3 h old); /analysis opponent strength |
| `reputationtier` | ✅ verified | reputation tier, 0-3; 0 = Hometown Heroes | reputation badge and ladder |
| `wstreak` | ✅ verified | current win streak | club page |
| `unbeatenstreak` | ✅ verified | current unbeaten streak | club page |
| `lastMatch0-9` | ✅ verified | recent results, 0 = newest Codes: `1` win, `2` loss, `3` draw, `-1` none. *Note:* only 5 filled although more games were played; maybe resets with the season |  |
| `lastOpponent0-9` | ✅ verified | club ids of recent opponents, 0 = newest *Note:* back-to-back games against the same club count once, so it does NOT line up with lastMatch |  |
| `bestDivision` | ⛔ useless | 'None' here, while allTimeLeaderboard/search says 4 |  |
| `bestFinishGroup` | ❓ unknown | None so far; probably the best Season Playoffs placing |  |
| `finishesInDivision1-6Group1` | ❓ unknown | all 0 so far; probably how often the season ended in each division |  |

## allTimeLeaderboard/search

`GET https://proclubs.ea.com/api/fc/allTimeLeaderboard/search?platform=common-gen5&clubName=<name>`

Clubs whose name matches, with their record and division. The site finds itself by club id among the results.

### Each matching club

Path: `[]`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `clubId`, `clubName` | ✅ verified | club id and name |  |
| `platform` | ✅ verified | common-gen5 or common-gen4 |  |
| `currentDivision` | ⛔ useless | runs one division behind: said 5 while the lobby showed Division 4, then 4 right after promotion to Division 3 (2026-10-11, the poll after the promotion game). Use the season tracker for the current division |  |
| `bestDivision` | 🟡 assumed | best division reached, but one division behind like currentDivision (still 4 after promotion to 3) | division ladder 'best' tag, together with the tracker's division |
| `points` | ❓ unknown | 24, then 29 and 32 on 2026-10-11 (+3 after the promotion win, unchanged after a loss); not the current division's points | club page 'League points, EA total' |
| `cleanSheets` | ✅ verified | club clean sheets this season | club page |
| `wins`, `losses`, `ties`, `gamesPlayed`, `gamesPlayedPlayoff`, `goals`, `goalsAgainst`, `promotions`, `relegations`, `reputationtier` | ✅ verified | same as clubs/overallStats |  |

### Club details

Path: `[].clubInfo`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `name`, `clubId`, `regionId`, `teamId` | ✅ verified | same as clubs/info |  |

### Kits, crest and stadium

Path: `[].clubInfo.customKit`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| *every field* | ✅ verified | same as customKit in clubs/matches |  |

## allTimeLeaderboard

`GET https://proclubs.ea.com/api/fc/allTimeLeaderboard?platform=common-gen5`

The top 100 clubs on the platform by Skill Rating (2441 down to 2132 on 2026-10-11). Fetched every check; the site keeps the fields below that it shows (snapshot 'leaderboard').

### Each club

Path: `[]`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `rank` | ✅ verified | 1-100 | World top 100 card on the club page and /top-100 |
| `clubId`, `clubName`, `platform` | ✅ verified | as in allTimeLeaderboard/search |  |
| `skillRating` | ✅ verified | Skill Rating; the list is sorted by it | how far the club is from #100 |
| `currentDivision`, `bestDivision` | 🟡 assumed | 1 or 2 for every top club; see the warning on currentDivision in allTimeLeaderboard/search |  |
| `bestFinishGroup` | ❓ unknown | always 0 |  |
| `reputationtier` | ✅ verified | reputation tier 0-2 among the top 100 |  |
| `reputationlevel` | 🟡 assumed | finer reputation level inside the tiers: tier 0 = level 3, tier 1 = levels 4-6, tier 2 = levels 7-8 *Note:* only here; overallStats and search give the tier alone | /top-100 |
| `wins`, `ties`, `losses`, `gamesPlayed`, `gamesPlayedPlayoff`, `goals`, `goalsAgainst`, `cleanSheets` | ✅ verified | the club's totals |  |
| `goalsPerGame`, `goalsAgainstPerGame` | ✅ verified | goals and goals against divided by games |  |

### Club details

Path: `[].clubInfo`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `name`, `clubId`, `regionId`, `teamId` | ✅ verified | same as clubs/info |  |

### Kits, crest and stadium

Path: `[].clubInfo.customKit`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| *every field* | ✅ verified | same as customKit in clubs/matches |  |

## members/stats

`GET https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=<id>`

Every member's season totals at this club. Whoever controls the CPU gets the CPU's numbers added, as in the match lines.

### Each member

Path: `members[]`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `name` | ✅ verified | gamertag |  |
| `proName` | ✅ verified | the Pro's name | player cards |
| `proHeight` | ✅ verified | the Pro's height in cm |  |
| `proNationality` | ✅ verified | the Pro's nation (EA nation id) | flags |
| `proOverall`, `proOverallStr` | ✅ verified | the Pro's overall rating (number and the same as text) | player cards |
| `proPos` | ✅ verified | position number, see lib/ea-assets.ts POSITIONS (5 = CB, 14 = CM, 25 = ST) |  |
| `proStyle` | ❓ unknown | -1 or 0; NOT the archetype *Evidence:* 2026-10-11: 0 for mo_nm (Target), Pakst- (Spark), EnEsC-37 (Magician) and dirty8ightt; -1 for the two newest members (x-LadruM-x, RUPPADOR). Maybe a leftover from older games' 'Pro style' |  |
| `favoritePosition` | ✅ verified | broad group (goalkeeper / defender / midfielder / forward) |  |
| `gamesPlayed`, `winRate`, `goals`, `assists`, `ratingAve`, `manOfTheMatch`, `redCards` | ✅ verified | season totals; include CPU stats for whoever controls the CPU | player pages and leaderboard (own goals/assists corrected from saved games) |
| `passesMade`, `passSuccessRate`, `tacklesMade`, `tackleSuccessRate`, `shotSuccessRate` | ✅ verified | season totals and % ; include CPU for the controller |  |
| `cleanSheetsDef`, `cleanSheetsGK` | ⛔ useless | 0 for everyone although the club has 4 clean sheets |  |
| `prevGoals1-10` | ✅ verified | goals in each of the last 10 games, 1 = newest | goals chart before the site had 10 saved games |
| `prevGoals` | ✅ verified | goals in the latest game, same as prevGoals1 (checked for all 6 members) |  |

### Squad by position

Path: `positionCount`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `goalkeeper`, `defender`, `midfielder`, `forward` | ✅ verified | members per favoritePosition |  |

## members/career/stats

`GET https://proclubs.ea.com/api/fc/members/career/stats?platform=common-gen5&clubId=<id>`

Every member's all-time totals at this club, with fewer fields than members/stats.

### Each member

Path: `members[]`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| `name`, `proPos`, `favoritePosition` | ✅ verified | as in members/stats |  |
| `gamesPlayed`, `goals`, `assists`, `manOfTheMatch`, `ratingAve` | ✅ verified | all-time totals at this club (the same as this season so far) | 'All-time at the club' tile on player pages, shown once it differs from this season |
| `prevGoals` | 🟡 assumed | goals in the latest game |  |

### Squad by position

Path: `positionCount`

| Field | How sure | What it is | Used on the site |
|---|---|---|---|
| *every field* | ✅ verified | as in members/stats |  |

## Hidden event counters

`match_event_aggregate_0` to `_3` on each player line. match_event_aggregate_0..3 hold 'id:count' pairs joined by commas; merge all four strings per player. 150 different ids seen so far.

The counters count the HUMAN's own actions. EA's headline goals/assists/shots add the CPU teammates' to the controller's line; the counters don't. So they give real per-player stats even for whoever plays ANY.

| Counter | How sure | What it counts | Evidence | Used for |
|---|---|---|---|---|
| `11` | ✅ verified | own assists | equals assists on 86/98 lines; all 12 mismatches are CPU-controller lines, counter lower | match_players.own_assists → match_players_effective.assists |
| `153` | ✅ verified | offside passes; EA's passesmade counts them as made, the in-game screen as attempted but not completed | dirty8ightt, Angola fest: Offside Passes 1 = 153; Passes 12 = 215 + 216 + 153 | see 215 |
| `164` | ✅ verified | own tackles won | equals tacklesmade on 56 of 60 human-only lines (totals 62 vs 67); on CPU-controller lines EA is 7–17 higher. In game: dirty8ightt, Angola fest: 2 sliding tackles, 0 won, 164 absent | match_players.own_tackles_made → match_players_effective.tackles_made |
| `191` | ❌ wrong | not part of missed passes | research dataset, 42,451 human-only lines: adding 191 to 215 + 216 + 153 drops the passattempts match from 89.1% to 86.9%; 1,038 of the 1,252 lines where 191 fires already match without it. Our first guess came from 60 lines | no longer used |
| `214` | ✅ verified | own goals scored | equals goals on 89/98 lines; all 9 mismatches are CPU-controller lines where the counter is lower | match_players.own_goals → match_players_effective.goals |
| `215` | ✅ verified | own completed passes | in-game Player Performance, Angola fest (13 Oct): dirty8ightt Completed 9 = 215, mo_nm 8 = 215; LA Seigue FC (14 Oct): dirty8ightt 9, mo_nm 8, RUPPADOR 12, x-LadruM-x 11, all = 215. The in-game screen leaves the CPU out (dirty8ightt ran it: 12 passes in game, 60 from EA). Total passes = 215 + 216 + 153 for 3 of 4; mo_nm 13 in game vs 12. EA's passesmade also counts offside passes: 215 + 153 = passesmade on 51 of 58 human-only lines of our club (22 games), the rest within ±2; totals 717 vs 716. On the 13 CPU-controller lines EA is 43–97 higher. A quitter (userResult 6) keeps them while EA wipes passes to 0 | match_players.own_passes_made → match_players_effective.passes_made |
| `216` | ✅ verified | own missed passes (not offside) | Angola fest: dirty8ightt 216 = 2 (12 passes, 9 completed, 1 offside), mo_nm 216 = 3 (11 passes, 8 completed); 215 + 216 + 153 = passattempts on 37,819 of 42,451 human-only lines (89.1%) in the EA FC Pro Clubs API research dataset | match_players.own_pass_attempts → match_players_effective.pass_attempts |
| `217` | ✅ verified | own shots, part 1 (probably on target) | 217 + 218 equals shots on 85/98 lines; all 13 mismatches are CPU-controller lines, counter lower | match_players.own_shots → match_players_effective.shots |
| `218` | ✅ verified | own shots, part 2 (probably off target) | see 217 | match_players.own_shots → match_players_effective.shots |

### From the EA FC Pro Clubs API research project

Mappings from the EA FC Pro Clubs API research project (github.com/Interactive-63/eafc-pro-clubs-api-research), worked out on 51,395 FC 27 player lines. Our own 142 lines agree wherever we had checked the same ids (13/18, 14/19, 6, 118, 229, 266, 153). Status 'assumed' until an in-game Player Performance screen confirms them here; checked so far against dirty8ightt (outfield) and mo_nm (GK), Angola fest, 13 Oct.

| Counter | How sure | What it counts | Used for |
|---|---|---|---|
| `6` | ✅ verified | interceptions *In game:* 0 = 0 for dirty8ightt (Angola fest); LA Seigue FC (14 Oct): mo_nm 1 = 1, dirty8ightt 0 = 0, x-LadruM-x 0 = 0; x-LadruM-x's Archetypes screen (Progressor, 14 Oct): Interceptions 22 = counter 6 summed over all 6 of his saved Progressor games. The same screen showed 65,563 to 65,567 for three other players, a game bug | lib/counters.ts → More stats, leaderboard |
| `96` | ✅ verified | straight red card (own) *Note:* research dataset, 42,451 human-only lines: 145 of 145 lines with 96 have an EA red, none without. Every EA red (692) has 96 or 95 + 213 >= 2 | red cards: an EA red without 96 or a second yellow is moved to the CPU (lib/poller.ts, migration 0015) |
| `115` | ✅ verified | second assists *In game:* 0 = 0 for both (Angola fest); LA Seigue FC (14 Oct): dirty8ightt 1 = 1, RUPPADOR 1 = 1, mo_nm 0 = 0, x-LadruM-x 0 = 0 | lib/counters.ts → More stats, leaderboard |
| `152` | 🟠 doubtful | through passes completed (through + lobbed through; the in-game Pass Type rows count completed passes) *In game:* Angola fest: dirty8ightt 152 = 5, in game 2 through + 2 lobbed through. LA Seigue FC (14 Oct): dirty8ightt 152 = 4 = 3 through + 1 lobbed through | lib/counters.ts → More stats (marked *) |
| `174` | ✅ verified | dribbles completed *In game:* dirty8ightt 7 = Dribbles Completed 7 (of 11); mo_nm 0 = 0 (Angola fest); LA Seigue FC (14 Oct): dirty8ightt 8, mo_nm 7, RUPPADOR 11, x-LadruM-x 6, all equal | lib/counters.ts → More stats, leaderboard |
| `202` | 🟡 assumed | shots saved (the shooter's) |  |
| `267` | ✅ verified | good-direction saves *Note:* research dataset: equals EA's goodDirectionSaves on 1,383 of 1,388 human keeper lines |  |
| `265, 266` | 🟡 assumed | aerial duels won, attacking (265) and defending (266) *In game:* dirty8ightt 1 = Aerial Duels Won 1 | lib/counters.ts → More stats |
| `108, 109, 110` | ❌ wrong | possession won in the defensive, middle and attacking third *In game:* not the in-game Possession Won: dirty8ightt 0 vs 1, mo_nm 0 vs 6 | no longer shown |
| `105, 106, 107` | ❌ wrong | possession lost in the defensive, middle and attacking third *In game:* not the in-game Possession Lost: dirty8ightt 4 vs 7, mo_nm 0 vs 3 | no longer shown |
| `2, 3` | 🟡 assumed | fouls conceded (3 = roughly in the defensive third) *In game:* dirty8ightt 1 = Fouls Committed 1; mo_nm 0 = 0 | lib/counters.ts → More stats |
| `95, 213` | 🟡 assumed | yellow cards: immediate (95) and after advantage (213) *Note:* research dataset (42,451 human-only lines): 547 of 692 EA reds have 95 + 213 >= 2 (second yellow), but 129 lines have 2 without any red (113 of them 95 = 2), so a 2 is sometimes one card | lib/counters.ts → More stats; second yellow for red cards (lib/poller.ts) |
| `51, 52` | ✅ verified | cross saves (51 + 52); not in the research list *Note:* research dataset: 51 + 52 equals EA's crossSaves on 1,360 of 1,388 human keeper lines (98.0%); 49, 50, 55 and 113 match no other save type |  |
| `13, 18` | 🟡 assumed | shots on target from inside (13) and outside (18) the box; 13 + 18 = 217 on all our 142 lines |  |
| `14, 19` | 🟡 assumed | shots off target from inside (14) and outside (19) the box; 14 + 19 = 218 on 141/142 of ours |  |
| `0, 1` | 🟡 assumed | tackles won (0) and lost (1) as the research counts them; our EA tacklesmade matches 164 instead, and 0 + 1 is not EA's tackleattempts |  |
| `229, 230, 121` | 🟡 assumed | standing (229) and sliding (230) tackles won; 121 is a near-duplicate of 229 |  |
| `30, 32, 34` | 🟡 assumed | completed passes forward, backward, sideways |  |
| `24, 26, 28, 36` | 🟡 assumed | completed passes short, medium, long, crosses |  |
| `31, 33, 35` | 🟡 assumed | missed passes forward, backward, sideways |  |
| `25, 27, 29, 37` | 🟡 assumed | missed passes short, medium, long, crosses |  |
| `143, 144, 147` | 🟡 assumed | first-time passes, switches of play, flair passes |  |
| `97, 112, 38` | 🟡 assumed | dribbles carried (97); beats incl. skill-move beats (112); skill-move beats (38) *In game:* 97 is not Players Beaten By Passes: dirty8ightt 7 = 7 but mo_nm 0 vs 4 |  |
| `4, 94, 10, 145, 156, 158, 163, 171` | 🟡 assumed | fouls won (4), penalties conceded (94), corners conceded (10), corners taken (145), crosses blocked (156), opponent dispossessed (158), dangerous tackles (163), free kicks for bad tackles (171) |  |
| `99-103, 219, 111` | 🟡 assumed | out of position, severity 1-5 (219 = their sum); in position (111) |  |
| `175, 176, 177, 182, 183, 207, 212` | 🟡 assumed | in-match feedback pop-ups (no good option, good/best option taken, should have passed elsewhere, chose to pass, pick your pass, use the ball) |  |
| `118, 128, 131, 136, 12, 93, 123, 124, 137, 140, 238` | 🟡 assumed | assist and goal descriptors: through-ball assist (118), first-time (128), weak foot (131), off the post (136), chip (123), other techniques; they overlap, so they don't add up to goals |  |

Guesses not proven yet:

- `114`: key passes (passes that led to a teammate's shot); not in the research list (≤ passes; per team ≤ the team's shots in 40/44 games; a player's assists are ≤ it on 133/142 lines. In game (Angola fest): dirty8ightt Key Passes 1 = 114, mo_nm 0 = 0. LA Seigue FC (14 Oct): dirty8ightt 2 = 2, mo_nm 1 = 1, RUPPADOR 1 = 1, but x-LadruM-x Key Passes 1 with no 114 (team total 5 in game, 4 from 114))

Not decoded yet: tackle attempts (no counter, pair or triple matches EA's tackleattempts); possession won/lost; players beaten by passes; failed dribbles (212 = 4 = 11 − 7 for dirty8ightt, one line only). In-game Player Performance screens can confirm the fromResearch mappings.

Derived:

- **cpuGoals**: club score minus the sum of counter 214 over the club's players; shown as “CPU” among the scorers on match pages and in Discord posts. Checked on 22 games (44 club-games): when someone runs the CPU, its goals sit on that player's EA line; when nobody does, they appear only in the score (6 goals, all in such games). No counter or club field marks own goals, so an opponent own goal can't be told apart and also lands here.
- **cpuReds**: an EA red on a line whose counters have neither 96 (straight red) nor 95 + 213 >= 2 (second yellow) is the CPU's; saved as a corrections row (created_by auto) when the match is first saved, so the club can give it back. 0 misses on the research dataset's 692 human reds.
- **cpuController**: the line whose EA goals/assists/shots exceed its counters; failing that, the line whose EA passesmade is 5+ above counters 215 + 153 (EA counts offside passes as made) (the CPU nearly always passes, rarely scores).

## Thanks

- [frdceri/clubs-hub](https://github.com/frdceri/clubs-hub) (`lib/lookups.js`): archetypeid → archetype names; regionId decoding. Thank you for working these out and publishing them.
- [Interactive-63/eafc-pro-clubs-api-research](https://github.com/Interactive-63/eafc-pro-clubs-api-research) (`README.md (event IDs and decoded stat formulas); data/eafc_27_raw_player_data.csv`): interceptions, second assists, through passes, dribbles, aerial duels, fouls and yellow cards from the hidden event counters; offside passes (153); their raw dataset showed counter 191 is not part of missed passes and decoded red cards (96, second yellow) and cross saves (51 + 52). Thank you for decoding and publishing the event counters. Found through Pro Clubs Tracker (proclubstracker.com), which credits it.
