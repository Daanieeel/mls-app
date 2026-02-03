import type { MessageModel } from './model';

export abstract class MessageService {
  static createMessage({ body }: { body: (typeof MessageModel.CreateMessageBody)['static'] }) {}
}
