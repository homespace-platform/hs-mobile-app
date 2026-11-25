// Port of hs-web-app components/contract/detail/ContractEquipmentSection.tsx (web colour classes mapped to theme tokens).
export const HANDOVER_CONDITION_CONFIG: Record<string, { label: string; className: string }> = {
  BRAND_NEW: {
    label: 'Mới 100%',
    className: 'bg-success-soft text-success border-success',
  },
  GOOD: {
    label: 'Còn tốt',
    className: 'bg-success-soft text-success border-success',
  },
  NORMAL: {
    label: 'Bình thường',
    className: 'bg-primary-soft text-primary border-primary-border',
  },
  USED_ACCEPTABLE: {
    label: 'Cũ, còn dùng được',
    className: 'bg-warning-soft text-warning border-warning',
  },
  MINOR_DAMAGE: {
    label: 'Hư hỏng nhẹ',
    className: 'bg-danger-soft text-danger border-danger',
  },
};

export function formatHandoverCondition(val?: unknown): {
  label: string;
  className: string;
} {
  if (!val) {
    return {
      label: 'Còn tốt',
      className: 'bg-success-soft text-success border-success',
    };
  }
  const s = String(val).trim();
  const upper = s.toUpperCase();
  if (HANDOVER_CONDITION_CONFIG[upper]) {
    return HANDOVER_CONDITION_CONFIG[upper];
  }
  for (const [key, cfg] of Object.entries(HANDOVER_CONDITION_CONFIG)) {
    if (upper.startsWith(key)) {
      const rest = s
        .substring(key.length)
        .replace(/^[\s—\-:]+/, '')
        .trim();
      return {
        label: rest ? `${cfg.label} — ${rest}` : cfg.label,
        className: cfg.className,
      };
    }
  }
  if (s.includes('tốt') || s.includes('Mới')) {
    return {
      label: s,
      className: 'bg-success-soft text-success border-success',
    };
  }
  if (s.includes('Hư hỏng')) {
    return {
      label: s,
      className: 'bg-danger-soft text-danger border-danger',
    };
  }
  return {
    label: s,
    className: 'bg-primary-soft text-primary border-primary-border',
  };
}
