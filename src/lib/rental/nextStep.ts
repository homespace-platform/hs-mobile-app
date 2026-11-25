// Port of hs-web-app components/contract/page/nextStep.ts (verbatim; only import paths changed).
import type { ContractLifecycle } from '@/types/rental/contract-lifecycle.type';
import type { AmendmentProposal } from '@/types/rental/contract-amendment.type';
import type { DetailTab, Role, Tone } from '@/lib/rental/rental-labels';

/**
 * The single next step of a contract that is past the pre-tenancy flow (no server `nextAction`), derived from data the
 * page already has: monthly invoices + closure + renewals (lifecycle read) and amendment proposals (workspace).
 * Pure: no routing here, `link` is mapped to a URL by the page.
 */
export type StepLink =
  | { kind: 'invoices'; section: 'monthly' | 'deposit'; invoiceId?: string }
  | { kind: 'contract'; id: string };
export interface NextStep {
  title: string;
  hint?: string;
  mine: boolean;
  tone: Tone;
  tab?: DetailTab;
  link?: StepLink;
  cta?: string;
}

export interface StepInput {
  role: Role;
  actorId: string;
  contract: { status: string; parentContractId?: string | null };
  lifecycle?: ContractLifecycle | null;
  proposals?: AmendmentProposal[];
}

const OPEN_BILL = new Set(['DRAFT', 'UNPAID', 'OVERDUE']);
const SIGNING_PENDING = new Set([
  'PENDING_REVIEW',
  'LANDLORD_SIGNATURE_PENDING',
  'TENANT_SIGNATURE_PENDING',
]);
const turn = (
  mine: boolean,
  mineStep: Omit<NextStep, 'mine' | 'tone'>,
  waiting: string
): NextStep =>
  mine
    ? { ...mineStep, mine: true, tone: 'info' }
    : { title: waiting, mine: false, tone: 'warning', link: mineStep.link, tab: mineStep.tab };

function signerOf(status?: string): Role {
  return status === 'TENANT_SIGNATURE_PENDING' || status === 'PENDING_REVIEW'
    ? 'TENANT'
    : 'LANDLORD';
}

/** The tenant never proposes the closure (server rule): say who acts, and name an obligation only when one really exists. */
function tenantWaitsForClosure(lifecycle: ContractLifecycle, link: StepLink): NextStep {
  return {
    title: 'Chờ chủ nhà lập đề xuất hoàn cọc',
    hint: lifecycle.billing.allPaid
      ? undefined
      : 'Còn hóa đơn chưa hoàn tất: hãy thanh toán để chủ nhà có thể lập đề xuất.',
    mine: false,
    tone: 'warning',
    link,
  };
}

function closureStep({ role, contract, lifecycle }: StepInput): NextStep | null {
  const landlord = role === 'LANDLORD';
  const closure = lifecycle?.closure;
  const link: StepLink = { kind: 'invoices', section: 'deposit' };
  if (!lifecycle) return null;
  if (!closure) {
    if (contract.status !== 'EXPIRED') return null;
    if (!landlord) return tenantWaitsForClosure(lifecycle, link);
    return lifecycle.canProposeClosure
      ? turn(
          landlord,
          {
            title: 'Lập đề xuất hoàn cọc',
            hint: 'Hết thời hạn thuê: chốt chi phí cuối, bàn giao và đề xuất số tiền hoàn.',
            link,
            cta: 'Mở hồ sơ hoàn cọc',
          },
          'Chờ chủ nhà lập đề xuất hoàn cọc'
        )
      : {
          title: 'Hợp đồng đã hết thời hạn thuê',
          hint: 'Hai bên hoàn tất hóa đơn cuối và bàn giao để quyết toán cọc.',
          mine: false,
          tone: 'neutral',
          link,
        };
  }
  const payment = lifecycle.refundPayment || lifecycle.balancePayment;
  const reported = payment?.status === 'TRANSFER_REPORTED';
  switch (closure.status) {
    case 'WAITING_HANDOVER':
      if (!landlord) return tenantWaitsForClosure(lifecycle, link);
      return lifecycle.canProposeClosure
        ? turn(
            landlord,
            {
              title: 'Lập đề xuất hoàn cọc',
              hint: 'Đã đủ hóa đơn: nêu khoản khấu trừ (nếu có) và số tiền hoàn.',
              link,
              cta: 'Mở hồ sơ hoàn cọc',
            },
            'Chờ chủ nhà lập đề xuất hoàn cọc'
          )
        : {
            title: 'Đang chờ bàn giao và hoàn tất hóa đơn cuối',
            hint: 'Cọc được xử lý sau khi bàn giao và thanh toán đủ hóa đơn.',
            mine: false,
            tone: 'neutral',
            link,
          };
    case 'PROPOSED':
      return turn(
        !landlord,
        {
          title: 'Xem và phản hồi đề xuất hoàn cọc',
          hint: 'Kiểm tra khoản khấu trừ và số tiền hoàn trước khi đồng ý.',
          link,
          cta: 'Xem đề xuất',
        },
        'Chờ người thuê phản hồi đề xuất hoàn cọc'
      );
    case 'DISPUTED':
      return turn(
        landlord,
        {
          title: 'Đối soát khoản khấu trừ',
          hint: 'Người thuê chưa đồng ý đề xuất hoàn cọc.',
          link,
          cta: 'Xem phản hồi',
        },
        'Chờ chủ nhà đối soát khoản khấu trừ'
      );
    case 'REFUND_PENDING':
      return reported
        ? turn(
            !landlord,
            { title: 'Xác nhận đã nhận tiền hoàn cọc', link, cta: 'Xác nhận' },
            'Chờ người thuê xác nhận đã nhận tiền hoàn'
          )
        : turn(
            landlord,
            { title: 'Chuyển khoản hoàn cọc cho người thuê', link, cta: 'Mở hồ sơ hoàn cọc' },
            'Chờ chủ nhà chuyển khoản hoàn cọc'
          );
    case 'BALANCE_PENDING':
      return reported
        ? turn(
            landlord,
            { title: 'Xác nhận đã nhận khoản còn thiếu', link, cta: 'Xác nhận' },
            'Chờ chủ nhà xác nhận khoản còn thiếu'
          )
        : turn(
            !landlord,
            {
              title: 'Thanh toán khoản còn thiếu',
              hint: 'Khoản khấu trừ lớn hơn tiền cọc đang giữ.',
              link,
              cta: 'Thanh toán',
            },
            'Chờ người thuê thanh toán khoản còn thiếu'
          );
    default:
      return null;
  }
}

function invoiceStep({ role, lifecycle }: StepInput): NextStep | null {
  const bills = (lifecycle?.billing.bills ?? []).filter((b) => OPEN_BILL.has(b.status));
  if (!bills.length) return null;
  const landlord = role === 'LANDLORD';
  // One invoice -> deep link to it (several periods would otherwise land on the wrong one).
  const linkTo = (list: typeof bills): StepLink => ({
    kind: 'invoices',
    section: 'monthly',
    ...(list.length === 1 ? { invoiceId: list[0].id } : {}),
  });
  const open = (b: (typeof bills)[number]) =>
    b.paymentStatus !== 'TRANSFER_REPORTED' && b.paymentStatus !== 'CONFIRMED';
  const label = (list: typeof bills) =>
    list.length === 1
      ? `kỳ ${list[0].billingPeriod?.paymentPeriodNumber ?? list[0].periodIndex}`
      : `${list.length} kỳ`;
  const reported = bills.filter((b) => b.paymentStatus === 'TRANSFER_REPORTED');
  const overdue = bills.filter((b) => b.status === 'OVERDUE' && open(b));
  const unpaid = bills.filter((b) => b.status === 'UNPAID' && open(b));
  const drafts = bills.filter((b) => b.status === 'DRAFT');
  if (landlord) {
    if (reported.length)
      return {
        title: `Xác nhận đã nhận tiền hóa đơn ${label(reported)}`,
        hint: 'Chỉ xác nhận khi tiền đã vào tài khoản.',
        mine: true,
        tone: 'info',
        link: linkTo(reported),
        cta: 'Mở hóa đơn',
      };
    // The server opens the landlord's overdue options a few days after the due date and says so with canResolveOverdue=false until then; an older backend omits the field, so keep showing the action.
    const resolvable = overdue.filter((b) => b.canResolveOverdue !== false);
    if (resolvable.length)
      return {
        title: `Hóa đơn ${label(resolvable)} đã quá hạn`,
        hint: 'Chọn hướng xử lý: nhắc thanh toán, dời hạn hoặc các phương án khác.',
        mine: true,
        tone: 'danger',
        link: linkTo(resolvable),
        cta: 'Xử lý hóa đơn',
      };
    if (drafts.length)
      return {
        title: `Chốt chỉ số cho hóa đơn ${label(drafts)}`,
        hint: 'Nhập chỉ số điện nước để phát hành hóa đơn.',
        mine: true,
        tone: 'info',
        link: linkTo(drafts),
        cta: 'Mở hóa đơn',
      };
    const waiting = [...overdue, ...unpaid];
    if (waiting.length)
      return {
        title: `Chờ người thuê thanh toán hóa đơn ${label(waiting)}`,
        hint: overdue.length
          ? 'Hóa đơn đã quá hạn; các phương án xử lý của chủ nhà mở khi đủ điều kiện, xem ở mục hóa đơn.'
          : undefined,
        mine: false,
        tone: 'warning',
        link: linkTo(waiting),
      };
    return null;
  }
  if (overdue.length)
    return {
      title: `Hóa đơn ${label(overdue)} đã quá hạn`,
      hint: 'Thanh toán sớm để tránh phí chậm trả và việc xử lý của chủ nhà.',
      mine: true,
      tone: 'danger',
      link: linkTo(overdue),
      cta: 'Thanh toán hóa đơn',
    };
  if (unpaid.length)
    return {
      title: `Thanh toán hóa đơn ${label(unpaid)}`,
      mine: true,
      tone: 'info',
      link: linkTo(unpaid),
      cta: 'Thanh toán hóa đơn',
    };
  if (reported.length)
    return {
      title: `Chờ chủ nhà xác nhận tiền hóa đơn ${label(reported)}`,
      mine: false,
      tone: 'warning',
      link: linkTo(reported),
    };
  return null;
}

function signingStep({ role, lifecycle, proposals = [] }: StepInput): NextStep | null {
  const other = role === 'LANDLORD' ? 'người thuê' : 'chủ nhà';
  for (const p of proposals) {
    if (p.status !== 'APPROVED' || !p.agreementContractId) continue;
    return turn(
      signerOf(p.agreementStatus) === role,
      {
        title: 'Ký phụ lục điều chỉnh hợp đồng',
        hint: 'Xem bản PDF rồi ký số. Chưa ký đủ thì điều khoản cũ vẫn áp dụng.',
        link: { kind: 'contract', id: p.agreementContractId },
        cta: 'Mở phụ lục để ký',
      },
      `Chờ ${other} ký phụ lục`
    );
  }
  for (const r of lifecycle?.renewals ?? []) {
    if (r.status === 'APPROVED' && r.agreementStatus === 'DRAFT')
      // just approved: the landlord still has to prepare the text (handled in the end tab)
      return turn(
        role === 'LANDLORD',
        {
          title: 'Chuẩn bị văn bản gia hạn để ký',
          hint: 'Mở văn bản gia hạn, kiểm tra nội dung rồi kết xuất PDF để ký số.',
          tab: 'end',
          cta: 'Chuẩn bị văn bản',
        },
        'Chờ chủ nhà chuẩn bị văn bản gia hạn'
      );
    if (
      r.status !== 'APPROVED' ||
      !r.agreementContractId ||
      !r.agreementStatus ||
      !SIGNING_PENDING.has(r.agreementStatus)
    )
      continue;
    return turn(
      signerOf(r.agreementStatus) === role,
      {
        title: 'Ký văn bản gia hạn',
        link: { kind: 'contract', id: r.agreementContractId },
        cta: 'Mở văn bản để ký',
      },
      `Chờ ${other} ký văn bản gia hạn`
    );
  }
  return null;
}

function requestStep({ role, actorId, lifecycle, proposals = [] }: StepInput): NextStep | null {
  const renewal = lifecycle?.renewals.some((r) => r.status === 'REQUESTED');
  if (renewal) {
    return role === 'LANDLORD'
      ? {
          title: 'Trả lời đề nghị gia hạn thuê',
          hint: 'Người thuê muốn kéo dài thời gian thuê.',
          mine: true,
          tone: 'info',
          tab: 'end',
          cta: 'Xem đề nghị',
        }
      : { title: 'Chờ chủ nhà trả lời đề nghị gia hạn', mine: false, tone: 'warning', tab: 'end' };
  }
  const waiting = proposals.find((p) =>
    ['REQUESTED', 'TENANT_REQUESTED', 'CHANGES_REQUESTED'].includes(p.status)
  );
  if (!waiting) return null;
  return turn(
    waiting.recipientId === actorId,
    {
      title: 'Phản hồi đề nghị điều chỉnh hợp đồng',
      hint: 'Xem nội dung thay đổi và ngày áp dụng.',
      tab: 'end',
      cta: 'Xem đề nghị',
    },
    'Chờ bên còn lại phản hồi đề nghị điều chỉnh'
  );
}

/** Signing documents linked to a root contract (amendment, renewal text): only who must sign. */
function childStep({ role, contract }: StepInput): NextStep | null {
  if (!SIGNING_PENDING.has(contract.status)) return null;
  return turn(
    signerOf(contract.status) === role,
    {
      title: 'Ký số văn bản',
      hint: 'Xem bản PDF rồi ký trong mục Ký số & tài liệu.',
      tab: 'sign',
      cta: 'Đi tới ký số',
    },
    'Chờ bên còn lại ký'
  );
}

export function deriveNextStep(input: StepInput): NextStep | null {
  if (input.contract.parentContractId) return childStep(input);
  if (!['ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED'].includes(input.contract.status)) return null;
  // Money in motion first, then pending signatures, then requests waiting for an answer.
  return closureStep(input) ?? invoiceStep(input) ?? signingStep(input) ?? requestStep(input);
}

/** Button text for the pre-tenancy primary action (go to the tab where the step is done). */
export function primaryLabel(tab: DetailTab): string {
  return {
    sign: 'Đi tới ký số',
    payment: 'Đi tới thanh toán',
    end: 'Xử lý đề nghị',
    content: 'Xem nội dung hợp đồng',
    history: 'Xem lịch sử',
    overview: 'Xem tổng quan',
  }[tab];
}
