import Elysia from 'elysia';

export const messageRouter = new Elysia({ prefix: '/keys' }).get('/:userId', () => {});
