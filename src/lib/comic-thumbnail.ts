import sharp from "sharp";
export const comicThumbnail=(bytes:Buffer)=>sharp(bytes,{limitInputPixels:40_000_000,failOn:"error"})
  .rotate().resize({width:320,height:640,fit:"inside",withoutEnlargement:true}).webp({quality:70}).toBuffer();

export async function comicReadingImage(bytes:Buffer){
 const reading=await sharp(bytes,{limitInputPixels:40_000_000,failOn:"error"}).rotate().webp({lossless:true,effort:5}).toBuffer();
 return reading.length<bytes.length?reading:null;
}
