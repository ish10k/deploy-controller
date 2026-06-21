# Contributing

Thanks for helping improve OneVersion.

Run the local checks before opening a change:

```bash
ruff check .
mypy src
pytest
```

Keep `domain/` and `application/` free of framework and AWS SDK imports. Add real deployment mechanics behind ports/adapters rather than directly inside use cases.


