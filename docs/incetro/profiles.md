# Profiles

Profiles live in `incetro/profiles/<id>.json`. A profile references components. It does not embed their contents.

```json
{
  "id": "django",
  "extends": ["core", "python"],
  "ecc": {
    "profile": "minimal",
    "skills": [
      "django-patterns",
      "django-security",
      "django-tdd",
      "django-verification"
    ]
  },
  "incetro": {
    "rules": [],
    "agents": [],
    "skills": []
  }
}
```

`extends` unions skills, modules, rules, agents, and skills from the parents. The child ECC profile name replaces the parent name. Hooks stay off unless a profile sets `"hooks": true`.

## Built-in profiles

| Profile | Detected from | ECC skills added |
| --- | --- | --- |
| core | no confident signal | none beyond ECC `minimal` |
| python | `pyproject.toml` or `requirements.txt` | `python-patterns`, `python-testing` |
| django | `manage.py` and a Django dependency | python skills plus Django skills |
| flutter | `pubspec.yaml` containing `flutter:` | `flutter-dart-code-review` |
| ios | `Package.swift` or `*.xcodeproj` | Swift skills |
| go | `go.mod` | Go skills |
| web | `package.json` | React and Next skills |

Django implies Python, so those two signals together select `django`. Two independent ecosystems, such as `go.mod` and `package.json`, select `core`.

```bash
incetro-ecc init --profile django
```
