# Code of Conduct

Dieses Projekt orientiert sich am Contributor Covenant.

Bitte lies die aktuelle Version hier:
https://www.contributor-covenant.org/version/2/1/code_of_conduct/

Verstöße oder Anliegen können an conduct@your-domain.example gemeldet werden.
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: weekly
      day: monday
      time: "06:00"
      timezone: "Europe/Berlin"
    open-pull-requests-limit: 10
    versioning-strategy: increase
    reviewers:
      - "maintainers-team"
    assignees:
      - "maintainers-team"
    labels:
      - "dependencies"
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: weekly
      day: monday
      time: "06:15"
      timezone: "Europe/Berlin"
    open-pull-requests-limit: 10
    versioning-strategy: increase
    reviewers:
      - "frontend-team"
    assignees:
      - "frontend-team"
    labels:
      - "dependencies"
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]

  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: weekly
      day: monday
      time: "06:30"
      timezone: "Europe/Berlin"
    open-pull-requests-limit: 10
    versioning-strategy: increase
    reviewers:
      - "backend-team"
    assignees:
      - "backend-team"
    labels:
      - "dependencies"
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: weekly
      day: monday
      time: "07:00"
      timezone: "Europe/Berlin"
    reviewers:
      - "devops-team"
    labels:
      - "ci"
      - "dependencies"
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]

