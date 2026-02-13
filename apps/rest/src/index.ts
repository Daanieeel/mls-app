import { env } from '@repo/env';
import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { authRouter } from './modules/auth';
import { groupRouter } from './modules/group';
import { inboxRouter } from './modules/inbox';
import { messageRouter } from './modules/message';
import { userRouter } from './modules/user';
import { keyPackageRouter } from './modules/key-package';
import { initKafka, kafkaPlugin } from './utils/kafka';

const PORT = env.PORT_REST;

const startServer = async () => {
  // Initialize Kafka before starting the server
  await initKafka();

  const app = new Elysia()
    .onError(({ code, error, set }) => {
      console.error('Error occurred:', {
        code,
        message: error?.message,
        stack: error?.stack,
        error: String(error),
        errorObject: error,
      });

      if (code === 'VALIDATION') {
        set.status = 400;
        return { error: 'Validation failed', details: error?.message };
      }

      set.status = 500;
      return { error: 'Internal server error', details: error?.message ?? String(error) };
    })
    .use(
      cors({
        origin: ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
      }),
    )
    .use(kafkaPlugin())
    .use(authRouter)
    .use(userRouter)
    .use(keyPackageRouter)
    .use(groupRouter)
    .use(inboxRouter)
    .use(messageRouter)
    .listen(PORT);

  console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);

  return app;
};

export type App = Awaited<ReturnType<typeof startServer>>;

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
