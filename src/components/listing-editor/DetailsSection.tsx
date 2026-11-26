// Web details/{Apartment,House,Room}DetailsSection, rendered from DETAIL_SECTIONS.
import { Anchor } from '@/components/rental/contract/anchors';
import DecimalInput from '@/components/rental/shared/DecimalInput';
import { DETAIL_SECTIONS, type ListingField } from '@/lib/listing-fields';
import { activeDetails } from '@/lib/listing-form';
import type { ListingCatalog } from '@/services/listingCreateApi';

import FurnishingAssets from './FurnishingAssets';
import { CheckRow, IntegerField, Section, SelectField, TextField, type SectionProps } from './ui';

/** Areas and lengths (keys ending in "M" / "M2") take decimals; other numbers are counts. */
const isDecimal = (key: string) => /M2?$/.test(key);

export default function DetailsSection({
  furnishings,
  ...props
}: SectionProps & { furnishings: ListingCatalog['furnishings'] }) {
  const { state, update, errors } = props;
  const { category } = state.basicInfo;
  const section = DETAIL_SECTIONS[category];
  const values = activeDetails(state) as Record<string, string | number | boolean | undefined>;

  function set(key: string, value: string | boolean) {
    const target = `${category}Details` as const;
    update((s) => ({ ...s, [target]: { ...s[target], [key]: value } }));
  }

  function render(field: ListingField) {
    const { key, type } = field;
    const label = `${field.label}${field.required ? ' *' : ''}`;
    const value = values[key];
    const shared = { label, hint: field.hint, error: errors[key] };
    if (type === 'select')
      return (
        <SelectField
          {...shared}
          value={String(value ?? '')}
          options={field.options ?? []}
          onChange={(next) => set(key, next)}
        />
      );
    if (type === 'checkbox')
      return <CheckRow label={label} checked={Boolean(value)} onPress={() => set(key, !value)} />;
    if (type === 'number' && isDecimal(key))
      return (
        <DecimalInput
          {...shared}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onValueChange={(next) => set(key, next)}
        />
      );
    if (type === 'number')
      return (
        <IntegerField
          {...shared}
          placeholder={field.placeholder}
          value={value}
          onValueChange={(next) => set(key, next)}
        />
      );
    return (
      <TextField
        {...shared}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        value={String(value ?? '')}
        onChangeText={(next) => set(key, next)}
      />
    );
  }

  return (
    <Section title={section.title} description={section.description}>
      {section.fields.map((field) =>
        field.type === 'furnishing-assets' ? (
          <FurnishingAssets key={field.key} {...props} options={furnishings} />
        ) : (
          <Anchor key={`${category}-${field.key}`} id={field.key}>
            {render(field)}
          </Anchor>
        )
      )}
    </Section>
  );
}
