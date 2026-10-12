---
name: google-stitch
description: Workflow and tool orchestration for Google Stitch in Antigravity IDE — generating screens, creating design variants, updating design systems, and converting Stitch UI designs into React Native / Expo code for Ripple. Use whenever the user asks to design, generate, mockup, prototype, or iterate on screens or UI components using Google Stitch.
---

# Google Stitch Integration for Ripple

This skill defines the end-to-end workflow for designing, generating, and implementing UI components using Google Stitch (`StitchMCP`) in the Antigravity IDE for the Ripple codebase.

---

## Active Configuration & Project Container

- **Stitch Project ID**: `12442498255896930215`
- **Resource Name**: `projects/12442498255896930215`
- **Project Title**: `Ripple Mobile App`
- **Active Design System Asset**: `assets/86e8012c4cca4e2a8b5de70c9bd736a9`
- **Design Specifications**: [DESIGN.md](file:///a:/Downloads/Claude/Ripple%20CLD/DESIGN.md)
- **Token Source of Truth**: [src/ui/theme.ts](file:///a:/Downloads/Claude/Ripple%20CLD/src/ui/theme.ts)

---

## Stitch MCP Tools Reference

All Stitch tools are lazily loaded via `call_mcp_tool` with `ServerName: "StitchMCP"`:

| Tool | Purpose | Key Arguments |
|---|---|---|
| `generate_screen_from_text` | Generate a new UI screen from a prompt | `projectId`, `prompt`, `deviceType: "MOBILE"`, `designSystem: "assets/86e8012c4cca4e2a8b5de70c9bd736a9"` |
| `get_screen` | Fetch screen metadata, download URLs, and HTML | `name: "projects/{projectId}/screens/{screenId}"` |
| `list_screens` | List screens in the project | `projectId` |
| `generate_variants` | Generate layout/aesthetic variants of an existing screen | `projectId`, `selectedScreenInstance`, `prompt` |
| `edit_screens` | Apply prompt-based modifications to existing screens | `projectId`, `selectedScreenInstances`, `prompt` |
| `upload_design_md` | Upload updated `DESIGN.md` (Base64) | `projectId`, `designMdBase64` |
| `apply_design_system` | Bind design system tokens to screen instances | `projectId`, `assetId`, `selectedScreenInstances` |

---

## Core Workflows

### 1. Generating a New Screen in Stitch

To generate a screen matching Ripple's dark terminal aesthetics:

```json
{
  "ServerName": "StitchMCP",
  "ToolName": "generate_screen_from_text",
  "Arguments": {
    "projectId": "12442498255896930215",
    "prompt": "<detailed description of screen, purpose, and key elements>",
    "deviceType": "MOBILE",
    "designSystem": "assets/86e8012c4cca4e2a8b5de70c9bd736a9",
    "modelId": "GEMINI_3_8_FLASH"
  }
}
```

> [!NOTE]
> Screen generation may take 30–90 seconds. If a timeout occurs, do NOT re-run generation immediately; poll `get_screen` or `list_screens` with `projectId: "12442498255896930215"`.

### 2. Inspecting Screen Output

1. Use `get_screen` to inspect the generated `htmlCode.downloadUrl` and screenshot `downloadUrl`.
2. Review the layout structure, information hierarchy, and components created by Stitch.

### 3. Translating Stitch UI to Ripple React Native Code

When translating generated Stitch HTML/CSS into React Native:

1. **Tokens**:
   - Map Stitch colors directly to `theme` via `useTheme()` (`theme.bg`, `theme.surface`, `theme.border`, `theme.accent`, `theme.up`, `theme.down`, `theme.textMuted`, etc.).
   - Never hardcode hex values.
2. **Typography**:
   - Map typography to `type.*` from [src/ui/theme.ts](file:///a:/Downloads/Claude/Ripple%20CLD/src/ui/theme.ts) (`type.title`, `type.heading`, `type.body`, `type.bodyTight`, `type.label`, `type.caption`, `type.micro`, `type.tag`).
3. **Accessibility**:
   - Comply strictly with [accessible-ui](file:///a:/Downloads/Claude/Ripple%20CLD/.agents/skills/accessible-ui/SKILL.md).
   - Ensure minimum 44x44px touch targets using `hitSlop` or `tapSlop()`.
   - Never nest `Pressable` inside another `Pressable` (sibling pattern for multi-action rows).
   - Provide `accessibilityRole` and descriptive `accessibilityLabel` on all interactive elements.

### 4. Updating the Design System

If tokens in [src/ui/theme.ts](file:///a:/Downloads/Claude/Ripple%20CLD/src/ui/theme.ts) change:
1. Update [DESIGN.md](file:///a:/Downloads/Claude/Ripple%20CLD/DESIGN.md).
2. Base64-encode the new `DESIGN.md`.
3. Call `upload_design_md` followed by `create_design_system_from_design_md` or `update_design_system`.
