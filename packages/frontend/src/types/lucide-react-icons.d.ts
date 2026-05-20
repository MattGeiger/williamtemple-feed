// Type shim for lucide-react's per-icon submodule exports.
//
// `ui/icons.tsx` imports the `__iconNode` arrays from `lucide-react/dist/
// esm/icons/*.js` directly for tree-shaking. Those files ship without
// `.d.ts` siblings, so without this shim TypeScript reports an implicit
// `any` (TS7016) for each import — about 150 errors in one file.
//
// The shape we expose here matches what `ui/icons.tsx` actually consumes
// (`__iconNode` is the array of [tag, attrs] tuples Lucide uses to render
// the SVG, and the default export is the React component built from it).

declare module 'lucide-react/dist/esm/icons/*' {
  import type { IconNode } from 'lucide-react';
  import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

  export const __iconNode: IconNode;

  const Icon: ForwardRefExoticComponent<
    SVGProps<SVGSVGElement> & RefAttributes<SVGSVGElement>
  >;
  export default Icon;
}
