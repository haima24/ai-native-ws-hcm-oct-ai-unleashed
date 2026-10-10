# Glossary

Shared vocabulary for stories, specs, tests and code. The last column lists confusing synonyms, not forbidden words in ordinary code. A definition is not evidence that code meets it. New business rules need ACs and tests, not just a glossary edit.

| Term | Definition | Do not call it |
|---|---|---|
| Card | One selectable value on the Fibonacci scale shown in the UI. | Option |
| Display name | The name a Participant types when joining. | Username, nickname |
| Fibonacci scale | The fixed set of cards: 0, 1, 2, 3, 5, 8, 13, 21, `?`. No custom scales. | Deck |
| Guest | A Participant who is not the Host. Cannot reveal or revote. | Player, client |
| Host | The room creator and the facilitator. Only the Host can Reveal and Revote. Also votes. | Admin, owner |
| Intent | A request a Guest sends to the Host to change room state (join, vote). | Event, command |
| Participant | Anyone in a room, Host included; all can vote. | User, member |
| Phase | Where the room is in a round: `voting` or `revealed`. | Status, state |
| Public view | The room state the Host broadcasts: who has voted, with vote values hidden until reveal. | Full state |
| Reducer | Pure function `(room, action) -> room` that applies every state change on the Host. | Handler |
| Results | Shown after reveal: each Participant's vote, grouped counts for accepted card values, and participation count. | Summary, report |
| Reveal | Host-only action that makes all votes visible to everyone at once. | Publish |
| Revote | Host-only action that clears all votes and returns the same room to `voting`. | Reset, next story |
| Room | Ephemeral shared space identified by a room code; ends when the Host closes the tab. | Session, lobby |
| Room code | Short code used to join a room; also embedded in the share link. | Room ID, PIN |
| Round | One voting cycle: `voting`, then `revealed`, until a Revote starts the next. | Turn |
| Share link | URL containing the room code that lets someone join directly. | Invite link |
| Theme | A per-device presentation setting (one of six looks) chosen by a Participant; stored locally, never shared with other Participants or sent over realtime. | Skin, room theme |
| Vote | One Participant's chosen card in the current round. Others see only "Voted" / "Not voted" until reveal. | Selection, answer |

## UI aliases and precise meanings

| UI label / term | Meaning |
|---|---|
| Players | UI heading for the Participant list; same entity, no separate Player model |
| Reveal estimates | Host-only button label for Reveal |
| Revote | Host-only button label for Revote |
| You | Annotation on the current Participant; not a role |
| Selected card | Local choice; can be pending and is not proof the Host accepted a Vote |
| Voted | The Host has accepted a Vote for this Participant in the current round |
| Not voted / No vote | No accepted Vote; different from the cast `?` value |
| `?` | A cast abstention; shown in the roster after reveal and counted as its own Results group |
| Waiting for Host | Guest-side text where the Host would see Reveal or Revote |
| Public view | Projection for shared display. Omitting values alone does not guarantee transport privacy (D-005) |

Use [UI/UX](../design/ui-ux.md) for screen labels and states, and [decisions](decisions.md) for proposed display rules.
