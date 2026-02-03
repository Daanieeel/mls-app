export abstract class GroupService {
  static createGroup(name: string): Promise<{ id: string; name: string }> {
    return Promise.resolve({ id: 'group-id', name });
  }
}
