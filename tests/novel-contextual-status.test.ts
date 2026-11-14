import {beforeEach,expect,it,vi} from 'vitest';
import {GET} from '../app/api/admin/novel-alignment/route';

const m=vi.hoisted(()=>({editor:vi.fn(),rpc:vi.fn(),from:vi.fn(),rows:[] as any[]}));
vi.mock('../src/lib/server',()=>({
 requireEditor:m.editor,jsonBody:(request:Request)=>request.json(),
 HttpError:class extends Error{constructor(message:string,public status=400){super(message);}},
 apiError:(error:any)=>Response.json({error:error.message},{status:error.status??400}),
}));
const request=()=>new Request('https://book.test/api/admin/novel-alignment?chapterId=chapter-1');
const old={chapter_id:'chapter-1',vi_version:'vi-current',en_version:'en-current',codec:'reader-dom-1',algorithm:'e5-mbert-uts95-1',state:'ready',updated_at:'old-time',last_error:'PRIVATE OLD ERROR'};
const local={...old,algorithm:'labse-context-mbert-1',state:'pending',updated_at:'local-time',last_error:'PRIVATE LOCAL ERROR'};

beforeEach(()=>{
 vi.clearAllMocks();m.rows=[];
 m.editor.mockResolvedValue({client:{rpc:m.rpc,from:m.from}});
 m.rpc.mockResolvedValue({data:{vi:{versionId:'vi-current'},en:{versionId:'en-current'},run:{path:'old-ready.json'}},error:null});
 m.from.mockImplementation(()=>{
  const filters:((row:any)=>boolean)[]=[];
  const result=()=>({data:m.rows.filter(row=>filters.every(filter=>filter(row))),error:null});
  const query:any={select:()=>query,
   eq:(column:string,value:unknown)=>{filters.push(row=>row[column]===value);return query;},
   in:(column:string,values:unknown[])=>{filters.push(row=>values.includes(row[column]));return query;},
   maybeSingle:async()=>({...result(),data:result().data[0]??null}),
   then:(resolve:any,reject:any)=>Promise.resolve(result()).then(resolve,reject),
  };
  return query;
 });
});

it('shows the local pending job while the existing e5 run stays available without caching private state',async()=>{
 m.rows=[old,local];
 const response=await GET(request());
 expect(await response.json()).toEqual({state:'pending',available:true,updatedAt:'local-time'});
 expect(response.headers.get('Cache-Control')).toBe('no-store');
});

it('prefers the book recipe while prior LaBSE results remain available',async()=>{
 m.rows=[old,local,{...local,algorithm:'labse-book-mbert-2',state:'running',updated_at:'book-time'}];
 expect(await (await GET(request())).json()).toEqual({state:'running',available:true,updatedAt:'book-time'});
});
it('prefers the poetry recipe over the previous book recipe',async()=>{
 m.rows=[local,{...local,algorithm:'labse-book-mbert-2',updated_at:'book-time'},{...local,algorithm:'labse-poetry-mbert-3',state:'running',updated_at:'poetry-time'}];
 expect(await (await GET(request())).json()).toEqual({state:'running',available:true,updatedAt:'poetry-time'});
});

it('falls back to e5 before migration and excludes other chapters, published versions, codecs and recipes',async()=>{
 m.rows=[old,{...local,vi_version:'vi-draft'},{...local,en_version:'en-stale'},{...local,chapter_id:'chapter-2'},
  {...local,codec:'other-codec'},{...local,algorithm:'semantic-align-1'},{...local,algorithm:'unapproved'}];
 expect(await (await GET(request())).json()).toEqual({state:'ready',available:true,updatedAt:'old-time'});
});

it('uses public run metadata for availability even when job rows say ready or running',async()=>{
 m.rows=[old,{...local,state:'running'}];
 m.rpc.mockResolvedValue({data:{vi:{versionId:'vi-current'},en:{versionId:'en-current'},run:null},error:null});
 expect(await (await GET(request())).json()).toEqual({state:'running',available:false,updatedAt:'local-time'});
});

it('requires an editor before reading publication or job data',async()=>{
 m.editor.mockRejectedValue(Object.assign(Error('Forbidden'),{status:403}));
 const response=await GET(request());
 expect(response.status).toBe(403);
 expect(await response.json()).toEqual({error:'Forbidden'});
 expect(m.rpc).not.toHaveBeenCalled();expect(m.from).not.toHaveBeenCalled();
});

it('returns missing for an incomplete published pair without inspecting drafts or jobs',async()=>{
 m.rpc.mockResolvedValue({data:{vi:{versionId:'vi-current'},en:null},error:null});
 const response=await GET(request());
 expect(await response.json()).toEqual({state:'missing'});
 expect(response.headers.get('Cache-Control')).toBe('no-store');
 expect(m.from).not.toHaveBeenCalled();
});
