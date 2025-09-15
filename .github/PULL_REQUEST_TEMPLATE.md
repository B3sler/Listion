<!-- Please read CONTRIBUTING.md before submitting. Provide a clear, focused PR. -->

## Summary 📝
Brief description of the changes and the motivation.

## Type of change 🔧
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] CI/CD
- [ ] Documentation
- [ ] Chore

## Linked issues 🔗
Closes #
Related #

## Test plan 🧪
Describe how reviewers can verify the change locally. Include steps and commands.

```bash
# Install
npm install

# Run app (both workspaces)
npm run dev

# Frontend
npm run --workspace frontend test
npm run --workspace frontend type-check
npm run --workspace frontend build

# Backend
npm run --workspace backend test
npm run --workspace backend type-check
npm run --workspace backend build
```

Steps to validate:
1. ...
2. ...
3. ...

## Screenshots / Recordings (optional) 📸
Add visuals or terminal output that help review the change.

## Breaking changes ⚠️
- [ ] This PR introduces breaking changes
If yes, describe the impact and provide migration steps:
- Impact:
- Migration:

## Security considerations 🔐
Note any security-relevant changes (auth, permissions, sensitive data, dependencies).

## API changes 📡
List any new/changed/removed endpoints and update Swagger annotations if applicable.

## Deployment notes (optional) 🚀
Any special rollout or config changes (env vars, secrets, migrations)?

## Checklist ✅
- [ ] Tests added/updated
- [ ] Linting and type-check pass locally (`npm run lint`, `npm run type-check`)
- [ ] Builds succeed for changed workspaces
- [ ] Docs/README updated if needed
- [ ] API docs updated (Swagger) if endpoints changed
- [ ] No secrets or sensitive data included
- [ ] Linked issues added (Closes/Related)
- [ ] Breaking changes documented with migration steps
