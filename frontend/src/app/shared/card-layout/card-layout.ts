export type { CardLayout, CardSideLayout, CardTextLine } from '../../../api/generated';

export const CARD_FONTS: Record<string, { family: string; file: string; hash: string }> = {
  BODY: {
    family: 'Workbench Card Body',
    file: '/fonts/PTSans-Regular.ttf',
    hash: '9cc831490532009bae2b3ce0d39c62adfc889060beb421593bfd9d2396d0f10a',
  },
  TITLE: {
    family: 'Workbench Card Title',
    file: '/fonts/PTSerif-Regular.ttf',
    hash: 'a4951fade06ff8f09b7673aa81ffb65a8cd409e24d3289a6dc670bc4dda2557a',
  },
};
