import {it,expect} from "vitest";
import sharp from "sharp";
import {createHash} from "node:crypto";
import {comicThumbnail} from "../src/lib/comic-thumbnail";
it("creates a small oriented WebP without changing original bytes",async()=>{
 const original=await sharp({create:{width:1200,height:2400,channels:3,background:"#8d342b"}}).jpeg().toBuffer();
 const hash=createHash("sha256").update(original).digest("hex"),thumb=await comicThumbnail(original),meta=await sharp(thumb).metadata();
 expect(meta.format).toBe("webp");expect(meta.width).toBeLessThanOrEqual(320);expect(meta.height).toBeLessThanOrEqual(640);
 expect(thumb.length).toBeLessThan(original.length);expect(createHash("sha256").update(original).digest("hex")).toBe(hash);
});
