# Feature modules

Planned modules and sub-modules (full design: `docs/design.md` §3). Each sub-module has its own
`controllers/ services/ repositories/ dto/ entities/`. Cross-module calls go through the exported
facade service or a RabbitMQ event — never another module's repository.

| module | sub-modules | tables |
|---|---|---|
| `auth` | `login` · `session` · `password` · `permission` | — (Redis) |
| `staff` | `profile` · `role` · `department` | `staff`, `staff_role`, `department` |
| `customer` | `profile` · `channel` · `order` · `overview` | `customer`, `customer_channel`, `customer_order`, `customer_tag` |
| `catalog` | — | `product` |
| `chat` | `enquiry` · `message` · `attachment` · `sla` · `customer-chat` | `chat`, `chat_message`, `chat_message_attachment`, `chat_tag`, `sla_policy` |
| `tag` | — | `tag` |
| `webhook` | `inbound` · `line` · `facebook` · `web-chat` · `outbound` | — |
| `sync` | — | — |
| `dashboard` | — | — |

Every schema change: edit the entity → `npm run migration:generate --name=<Change>` → review the file → `npm run migration:run`.
