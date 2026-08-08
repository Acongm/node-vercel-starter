import {
  ChatMessageRecord,
  selectMessageBranch,
} from '../src/modules/chat/chat.types';

function row(
  id: string,
  role: 'user' | 'assistant',
  parentMessageId: string | null,
  content: string,
): ChatMessageRecord {
  return {
    id,
    chat_id: 'chat-1',
    user_id: 'user-1',
    client_message_id: `client-${id}`,
    parent_message_id: parentMessageId,
    role,
    parts: [{ type: 'text', text: content }],
    metadata: {},
    created_at: '2026-08-08T00:00:00.000Z',
  };
}

describe('selectMessageBranch', () => {
  it('walks only the selected parent chain and excludes sibling regeneration branches', () => {
    const messages = [
      row('u1', 'user', null, 'question'),
      row('a1', 'assistant', 'u1', 'old answer'),
      row('a2', 'assistant', 'u1', 'new answer'),
      row('u2', 'user', 'a2', 'follow up'),
    ];

    expect(selectMessageBranch(messages, 'u2').map((message) => message.id)).toEqual([
      'u1',
      'a2',
      'u2',
    ]);
  });

  it('stops safely when a referenced parent is missing instead of appending unrelated rows', () => {
    const messages = [
      row('unrelated', 'user', null, 'ignore me'),
      row('head', 'user', 'missing-parent', 'head'),
    ];

    expect(selectMessageBranch(messages, 'head').map((message) => message.id)).toEqual([
      'head',
    ]);
  });

  it('guards against accidental parent cycles', () => {
    const messages = [
      row('u1', 'user', 'a1', 'question'),
      row('a1', 'assistant', 'u1', 'answer'),
    ];

    expect(selectMessageBranch(messages, 'a1').map((message) => message.id)).toEqual([
      'u1',
      'a1',
    ]);
  });
});
