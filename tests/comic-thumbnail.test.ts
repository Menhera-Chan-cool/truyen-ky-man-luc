import {it,expect} from "vitest";
import sharp from "sharp";
import {createHash} from "node:crypto";
import {comicThumbnail,comicReadingImage} from "../src/lib/comic-thumbnail";
it("creates a small oriented WebP without changing original bytes",async()=>{
 const original=await sharp({create:{width:1200,height:2400,channels:3,background:"#8d342b"}}).jpeg().toBuffer();
 const hash=createHash("sha256").update(original).digest("hex"),thumb=await comicThumbnail(original),meta=await sharp(thumb).metadata();
 expect(meta.format).toBe("webp");expect(meta.width).toBeLessThanOrEqual(320);expect(meta.height).toBeLessThanOrEqual(640);
 expect(thumb.length).toBeLessThan(original.length);expect(createHash("sha256").update(original).digest("hex")).toBe(hash);
});

it("reading WebP preserves every oriented pixel at full resolution",async()=>{
 expect(comicReadingImage).toBeTypeOf("function");
 const original=await sharp({create:{width:900,height:1400,channels:3,background:"#faf3df"}}).composite([{input:Buffer.from('<svg width="900" height="1400"><text x="50" y="100" font-size="32">Chú thích 1: Nguyễn Dữ</text></svg>')}]).png().toBuffer();
 const copy=Buffer.from(original),reading=await comicReadingImage(original);
 expect(reading!.length).toBeLessThan(original.length);expect(original.equals(copy)).toBe(true);
 expect((await sharp(reading!).ensureAlpha().raw().toBuffer()).equals(await sharp(original).ensureAlpha().raw().toBuffer())).toBe(true);
 const a=await sharp(reading!).metadata();expect([a.width,a.height]).toEqual([900,1400]);
});
