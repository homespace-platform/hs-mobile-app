// Minimal stand-in for web components/chat/AiMarkdownMessage.tsx (the app has no markdown library):
// headings, bullet / numbered lines, quotes, **bold**, *italic*, [label](url) links and GFM tables.
// shortcut: code blocks, images and bare URLs stay plain text; add a markdown library if needed.
import { Linking, ScrollView, Text, View } from 'react-native';

import { webBaseUrl } from '@/config/env';
import { formatHousingWording } from '@/lib/housing-wording';

import { markdownLines, type MarkdownPart } from './logic';

function Runs({ parts }: { parts: MarkdownPart[] }) {
  return parts.map(({ text: rawText, bold, italic, href }, index) => {
    const text = formatHousingWording(rawText);
    const style = `${bold ? 'font-semibold' : ''} ${italic ? 'italic' : ''}`;
    return href ? (
      <Text
        key={index}
        accessibilityRole="link"
        onPress={() => void Linking.openURL(href).catch(() => undefined)}
        className={`text-primary underline ${style}`}>
        {text}
      </Text>
    ) : bold || italic ? (
      <Text key={index} className={style}>
        {text}
      </Text>
    ) : (
      text
    );
  });
}

function Table({ rows }: { rows: MarkdownPart[][][] }) {
  return (
    <ScrollView
      horizontal
      accessibilityLabel="Bảng thông tin"
      className="rounded-xl border border-border bg-surface">
      <View>
        {rows.map((cells, row) => (
          <View key={row} className={`flex-row ${row ? 'border-t border-border' : 'bg-muted'}`}>
            {cells.map((parts, column) => (
              <Text
                key={column}
                selectable
                className={`w-36 px-2.5 py-2 text-xs leading-5 text-foreground ${row ? '' : 'font-semibold'}`}>
                <Runs parts={parts} />
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function AiText({ content }: { content: string }) {
  return (
    <View className="gap-1">
      {markdownLines(content, webBaseUrl).map((line, index) =>
        line.table ? (
          <Table key={index} rows={line.table} />
        ) : (
          <View
            key={index}
            className={`flex-row gap-2 ${line.quote ? 'border-l-2 border-primary bg-muted py-1 pl-3' : line.marker ? 'pl-1' : ''}`}>
            {line.marker ? (
              <Text className="text-sm leading-6 text-foreground">{line.marker}</Text>
            ) : null}
            <Text
              selectable
              className={`flex-1 text-sm leading-6 ${line.quote ? 'italic text-muted-foreground' : 'text-foreground'} ${line.heading ? 'font-bold' : ''}`}>
              <Runs parts={line.parts} />
            </Text>
          </View>
        )
      )}
    </View>
  );
}
