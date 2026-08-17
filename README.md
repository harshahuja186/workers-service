# worker-service

BullMQ consumer for jobs produced by `todo-backend`.

```bash
cp .env.example .env   # fill REDIS_* to match todo-backend
npm start              # node src/workers/worker.js
```

Queue name must match the API (`BULLMQ_QUEUE=todo`). Job name is the event (`login`, `signup`, …).
