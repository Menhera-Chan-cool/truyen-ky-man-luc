import type {CSSProperties} from "react";
import {headingFontId,headingFontFamily} from "../lib/heading-fonts";
export const headingFontStyle=(id:unknown)=>({"--heading-font-family":headingFontFamily(id)}) as CSSProperties;
export default function HeadingFontFaces({ids}:{ids:unknown[]}){
 return [...new Set(ids.map(headingFontId))].filter(id=>id!=="default").map(id=><style key={id} data-heading-font-face={id}>{`@font-face{font-family:"TKML Heading ${id}";src:url("/api/heading-fonts/${id}");font-weight:400;font-style:normal;font-display:swap}`}</style>);
}
