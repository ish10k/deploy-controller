FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY sdk/python ./sdk/python
COPY runner-example ./runner-example

RUN pip install --no-cache-dir -e ./sdk/python -e ./runner-example

CMD ["python", "-m", "runner_example"]
