import {getBook} from '../../../src/lib/server';
export async function GET(){try{return Response.json(await getBook(true),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Published book unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}}
