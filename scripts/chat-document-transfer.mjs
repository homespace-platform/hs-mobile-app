export function receiveDocumentChunks(read, render) {
  let file;
  let format;
  let offset = 0;
  let started = false;

  return (message) => {
    if (message?.type === 'begin' && !started) {
      if (
        !Number.isSafeInteger(message.size) ||
        message.size < 1 ||
        message.size > 25 * 1024 * 1024 ||
        !['pdf', 'docx', 'doc'].includes(message.format)
      )
        throw new Error('Invalid document transfer');
      file = new Uint8Array(message.size);
      format = message.format;
      started = true;
      read(0);
    } else if (message?.type === 'chunk' && file) {
      if (message.offset < offset) return;
      if (message.offset !== offset) throw new Error('Unexpected document offset');
      const chunk = atob(message.data);
      if (!chunk.length || offset + chunk.length > file.length) {
        throw new Error('Unexpected document size');
      }
      for (let index = 0; index < chunk.length; index += 1) {
        file[offset + index] = chunk.charCodeAt(index);
      }
      offset += chunk.length;
      if (offset < file.length) {
        read(offset);
      } else {
        const data = file;
        file = undefined;
        render(data, format);
      }
    }
  };
}
