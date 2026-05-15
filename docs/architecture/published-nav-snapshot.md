# Published Navigation Layout — Snapshot

> **Captured:** 2026-05-15 (post `phase3-prelude-complete`, after migrations 1819000000000-seed-default-navigation-module + 1943000000000-remove-orphan-studio-views-nav-node landed).
>
> **Source revision:** `metadata.navigation_module_revisions` where `status='published'`.
>
> **Purpose:** reference artifact for what the web client's left navigator renders. Regenerate via the SQL below when the published revision changes; do not hand-edit. Stays useful in the squash-to-baseline window — the seed migrations themselves are the source of truth for the layout in fresh installs, but this snapshot is the human-readable version of "what should I expect to see in the sidebar".

## Revision metadata

| Column | Value |
|---|---|
| `navigation_module.code` | `primary` |
| `navigation_module.name` | Primary Navigation |
| `navigation_module_revision.id` | `3ccc3c63-4b33-49be-8857-05df56b98359` |
| `navigation_module_revision.status` | `published` |
| `navigation_module_revision.revision` | 1 |
| `navigation_module_revision.created_at` | 2026-05-15 16:17:20 UTC |

## Top-level structure

7 top-level nodes. Each `module` is a leaf with a `route`; each `group` has `children`.

| # | Key | Type | Label | Route / Children |
|---:|---|---|---|---|
| 1 | `home` | module | Home | `/home` |
| 2 | `studio` | group | Studio | 8 children: users, groups, roles, collections, navigation, sso, ldap, audit |
| 3 | `automation` | group | Automation | 2 children: rules, process-flows |
| 4 | `integrations` | group | Integrations | 4 children: api, webhooks, import-export, marketplace |
| 5 | `ai` | group | AVA Intelligence | 9 children: query, reports, predictive-ops, digital-twins, self-healing, docs, agile, app-builder, upgrade |
| 6 | `notifications` | module | Notifications | `/notifications` |
| 7 | `settings` | group | Settings | 5 children: profile, security, themes, mfa, delegations |

**Total leaf modules (routes):** 30.

### Notes on key naming

- The `ai.*` keys are the user-facing surface of what the backend still calls `phase7/*`. Per Stream 3 deletion ledger item A7, the backend rename is deferred to W3 (SDK/runtime stabilization wave). The nav already uses the canonical `ai.*` keys, so no nav change is needed when A7 lands.
- The `studio.views` key was removed by migration `1943000000000-remove-orphan-studio-views-nav-node.ts` because no `<Route path="/studio/views">` exists in the web client. Views are accessed per-collection at `/studio/collections/:id/views`.

## Full layout JSON

```json
{
    "nodes": [
        {
            "key": "home",
            "icon": "home",
            "type": "module",
            "label": "Home",
            "route": "/home"
        },
        {
            "key": "studio",
            "icon": "settings-2",
            "type": "group",
            "label": "Studio",
            "children": [
                {
                    "key": "studio.users",
                    "icon": "users",
                    "type": "module",
                    "label": "Users",
                    "route": "/studio/users"
                },
                {
                    "key": "studio.groups",
                    "icon": "users-round",
                    "type": "module",
                    "label": "Groups",
                    "route": "/studio/groups"
                },
                {
                    "key": "studio.roles",
                    "icon": "shield",
                    "type": "module",
                    "label": "Roles & Permissions",
                    "route": "/studio/roles"
                },
                {
                    "key": "studio.collections",
                    "icon": "database",
                    "type": "module",
                    "label": "Collections",
                    "route": "/studio/collections"
                },
                {
                    "key": "studio.navigation",
                    "icon": "menu",
                    "type": "module",
                    "label": "Navigation",
                    "route": "/studio/navigation"
                },
                {
                    "key": "studio.sso",
                    "icon": "key-round",
                    "type": "module",
                    "label": "SSO Configuration",
                    "route": "/studio/sso"
                },
                {
                    "key": "studio.ldap",
                    "icon": "server",
                    "type": "module",
                    "label": "LDAP Configuration",
                    "route": "/studio/ldap"
                },
                {
                    "key": "studio.audit",
                    "icon": "scroll-text",
                    "type": "module",
                    "label": "Audit Logs",
                    "route": "/studio/audit"
                }
            ]
        },
        {
            "key": "automation",
            "icon": "zap",
            "type": "group",
            "label": "Automation",
            "children": [
                {
                    "key": "automation.rules",
                    "icon": "zap",
                    "type": "module",
                    "label": "Automation Rules",
                    "route": "/automation"
                },
                {
                    "key": "automation.process-flows",
                    "icon": "git-branch",
                    "type": "module",
                    "label": "Process Flows",
                    "route": "/process-flows"
                }
            ]
        },
        {
            "key": "integrations",
            "icon": "plug",
            "type": "group",
            "label": "Integrations",
            "children": [
                {
                    "key": "integrations.api",
                    "icon": "code",
                    "type": "module",
                    "label": "API Explorer",
                    "route": "/integrations/api"
                },
                {
                    "key": "integrations.webhooks",
                    "icon": "webhook",
                    "type": "module",
                    "label": "Webhooks",
                    "route": "/integrations/webhooks"
                },
                {
                    "key": "integrations.import-export",
                    "icon": "arrow-left-right",
                    "type": "module",
                    "label": "Import/Export",
                    "route": "/integrations/import-export"
                },
                {
                    "key": "integrations.marketplace",
                    "icon": "store",
                    "type": "module",
                    "label": "Marketplace",
                    "route": "/integrations/marketplace"
                }
            ]
        },
        {
            "key": "ai",
            "icon": "sparkles",
            "type": "group",
            "label": "AVA Intelligence",
            "children": [
                {
                    "key": "ai.query",
                    "icon": "message-circle",
                    "type": "module",
                    "label": "Chat with AVA",
                    "route": "/ai/query"
                },
                {
                    "key": "ai.reports",
                    "icon": "file-bar-chart",
                    "type": "module",
                    "label": "AI Reports",
                    "route": "/ai/reports"
                },
                {
                    "key": "ai.predictive-ops",
                    "icon": "trending-up",
                    "type": "module",
                    "label": "Predictive Operations",
                    "route": "/ai/predictive-ops"
                },
                {
                    "key": "ai.digital-twins",
                    "icon": "copy",
                    "type": "module",
                    "label": "Digital Twins",
                    "route": "/ai/digital-twins"
                },
                {
                    "key": "ai.self-healing",
                    "icon": "heart-pulse",
                    "type": "module",
                    "label": "Self-Healing",
                    "route": "/ai/self-healing"
                },
                {
                    "key": "ai.docs",
                    "icon": "book-open",
                    "type": "module",
                    "label": "Living Documentation",
                    "route": "/ai/docs"
                },
                {
                    "key": "ai.agile",
                    "icon": "kanban",
                    "type": "module",
                    "label": "Agile Development",
                    "route": "/ai/agile"
                },
                {
                    "key": "ai.app-builder",
                    "icon": "blocks",
                    "type": "module",
                    "label": "App Builder",
                    "route": "/ai/app-builder"
                },
                {
                    "key": "ai.upgrade",
                    "icon": "arrow-up-circle",
                    "type": "module",
                    "label": "Upgrade Assistant",
                    "route": "/ai/upgrade"
                }
            ]
        },
        {
            "key": "notifications",
            "icon": "bell",
            "type": "module",
            "label": "Notifications",
            "route": "/notifications"
        },
        {
            "key": "settings",
            "icon": "settings",
            "type": "group",
            "label": "Settings",
            "children": [
                {
                    "key": "settings.profile",
                    "icon": "user",
                    "type": "module",
                    "label": "Profile",
                    "route": "/settings/profile"
                },
                {
                    "key": "settings.security",
                    "icon": "lock",
                    "type": "module",
                    "label": "Security",
                    "route": "/settings/security"
                },
                {
                    "key": "settings.themes",
                    "icon": "palette",
                    "type": "module",
                    "label": "Themes",
                    "route": "/settings/themes"
                },
                {
                    "key": "settings.mfa",
                    "icon": "smartphone",
                    "type": "module",
                    "label": "Two-Factor Auth",
                    "route": "/settings/mfa-setup"
                },
                {
                    "key": "settings.delegations",
                    "icon": "user-check",
                    "type": "module",
                    "label": "Delegations",
                    "route": "/settings/delegations"
                }
            ]
        }
    ]
}
```

## Regenerate

```bash
docker exec hw_postgres psql -U hubblewave -d hubblewave \
  -t -A -c "SELECT jsonb_pretty(layout) FROM metadata.navigation_module_revisions WHERE status='published' LIMIT 1"
```
