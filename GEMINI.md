# Ripple CLD - Agent & IDE Guidelines

## Design System & Google Stitch Integration

Google Stitch is fully integrated into this IDE environment via **StitchMCP** to handle AI-assisted UI design, screen generation, and prototyping for the Ripple mobile application.

- **Stitch Project ID**: `12442498255896930215` (`projects/12442498255896930215`)
- **Stitch Design System Asset**: `assets/86e8012c4cca4e2a8b5de70c9bd736a9`
- **Design Tokens Specification**: [DESIGN.md](file:///a:/Downloads/Claude/Ripple%20CLD/DESIGN.md)
- **Token Code Source**: [src/ui/theme.ts](file:///a:/Downloads/Claude/Ripple%20CLD/src/ui/theme.ts)
- **Stitch Skill & Workflows**: [.agents/skills/google-stitch/SKILL.md](file:///a:/Downloads/Claude/Ripple%20CLD/.agents/skills/google-stitch/SKILL.md)

### Rules for UI Generation & Implementation
1. **Use the Stitch Design System**: Whenever generating screens in Stitch (`generate_screen_from_text`), always supply `projectId: "12442498255896930215"` and `deviceType: "MOBILE"` with `designSystem: "assets/86e8012c4cca4e2a8b5de70c9bd736a9"`.
2. **Translate to React Native House Style**: When bringing generated Stitch screens into code:
   - Use `useTheme()` and `makeStyles()` from [src/ui/ThemeProvider.tsx](file:///a:/Downloads/Claude/Ripple%20CLD/src/ui/ThemeProvider.tsx).
   - Use typography scale tokens from [src/ui/theme.ts](file:///a:/Downloads/Claude/Ripple%20CLD/src/ui/theme.ts).
   - Adhere strictly to the accessibility house style in [.agents/skills/accessible-ui/SKILL.md](file:///a:/Downloads/Claude/Ripple%20CLD/.agents/skills/accessible-ui/SKILL.md) (minimum 44x44px touch targets, sibling Pressables, no nested touchables, descriptive labels).
