import {expect,it} from 'vitest';
import {extractAlignmentText} from '../src/lib/novel-text';
import {makeAlignmentInput} from '../scripts/align-novel/input';
import {makeContextInput} from '../scripts/align-novel/context-input';
const bodies=(html:string,locale:'vi'|'en')=>{const e=extractAlignmentText(html,locale);return {e,poems:e.poems.map(p=>p.lines.map(l=>e.text.slice(l.start,l.end)))}};

it('retains a Vietnamese couplet across blank paragraphs after a verse introduction',()=>{
 const {poems}=bodies('<p>Có câu thơ:</p><p>Giang đông nhiều tay giỏi,</p><p> </p><p>Cuốn đất quay về biết đâu.</p><p>Ông cười mà rằng:</p>','vi');
 expect(poems).toEqual([['Giang đông nhiều tay giỏi,','Cuốn đất quay về biết đâu.']]);
});
it('preserves four br lines without adding characters to canonical Reader text',()=>{
 const {e,poems}=bodies('<p>Written was a quatrain:</p><p><em>Smiling, she wears jade,<br>His longing still remains.<br>This gift awaits the night,<br>The lovers meet again.</em></p>','en');
 expect(poems[0]).toHaveLength(4);expect(e.text).not.toContain('\n');expect(poems[0][1]).toBe('His longing still remains.');
});
it('recovers adjacent emphasized lines inside a flattened paragraph',()=>{
 const {poems}=bodies('<p><em>First verse walks away.</em> <em>Second verse comes home.</em> <em>Third verse sees the rain.</em> <em>Fourth verse ends the song.</em></p>','en');
 expect(poems).toHaveLength(1);expect(poems[0]).toHaveLength(4);
});
it('splits named poems at strong titles rather than including titles as lines',()=>{
 const html='<p><strong>Mountain Clouds</strong></p><p><em>Clouds drift far away.</em></p><p><em>Clouds come home again.</em></p><p><strong>Mountain Rain</strong></p><p><em>Rain falls on the ground.</em></p><p><em>Stars fall from the sky.</em></p>';
 const {e,poems}=bodies(html,'en');expect(poems).toHaveLength(2);
 expect(e.poems.map(p=>e.text.slice(p.title!.start,p.title!.end))).toEqual(['Mountain Clouds','Mountain Rain']);
 expect(poems.flat()).not.toContain('Mountain Clouds');
});
it('recognizes an inline quoted couplet without swallowing surrounding prose',()=>{
 const {poems}=bodies('<p>Those two lines—<em>Heaven brings defeat / Earth leaves no land</em>—are accurate enough.</p>','en');
 expect(poems).toEqual([['Heaven brings defeat','Earth leaves no land']]);
});
it('keeps unstructured intro-marked verse as a flattened poem context instead of inventing line boundaries',()=>{
 const {e}=bodies('<p>He composed the following poem:</p><p>Far away the clouds have never kept a single shape. Along the sky they linger slowly in the rain. They leave again beneath the light of morning. And they return before the fading sun.</p>','en');
 expect(e.poems).toHaveLength(1);expect(e.poems[0].flattened).toBe(true);expect(e.poems[0].lines).toHaveLength(1);
});
it('does not classify ordinary short dialogue or italic emphasis as poetry',()=>{
 expect(bodies('<p>He spoke:</p><p>"Come home now."</p><p>"I will return."</p><p>He was <em>very happy</em> to hear this.</p>','en').poems).toEqual([]);
});
it('does not carry a consumed poem introduction into the following narrative',()=>{
 const {e}=bodies('<p>Here are two lines:</p><p><em>Clouds drift far away.</em></p><p><em>Clouds return before sunset.</em></p><p>Having finished the inscription, he returned to the inn and fell asleep. A messenger came and invited him to visit a palace.</p>','en');
 expect(e.poems).toHaveLength(1);expect(e.text.slice(e.poems[0].start,e.poems[0].end)).not.toContain('Having finished');
});
it('does not append a short narrative paragraph to a plain Vietnamese couplet',()=>{
 const {poems}=bodies('<p>Có câu thi:</p><p>Giang đông nhiều tay giỏi,</p><p>Cuốn đất quay về biết đâu.</p><p>Thơ mỗi ngày thêm nhiều. Ông chỉ thích hai câu sau.</p>','vi');
 expect(poems).toEqual([['Giang đông nhiều tay giỏi,','Cuốn đất quay về biết đâu.']]);
});
it('allows a quoted flattened poem only after an explicit poetry introduction',()=>{
 const {e}=bodies('<p>He recited a poem:</p><p>"I recall our days together, When we were bound in harmony. Too soon we parted, and sorrow lingered in the courtyard. The moon has passed beyond the distant ridge, but still the old love remains."</p>','en');
 expect(e.poems).toHaveLength(1);expect(e.poems[0].flattened).toBe(true);
});
it('does not mistake discussion of poetry followed by dialogue for a poem',()=>{
 const {e}=bodies('<p>Nhân bàn đến thơ văn, ông khách nói:</p><p>- Những người xưa có tài khác nhau. Tôi đã đọc nhiều tác phẩm của họ và rất thích những câu chuyện ấy, nhưng hôm nay không tiện bàn thêm.</p>','vi');
 expect(e.poems).toEqual([]);
});
it('recognizes a couplet introduction with a trailing footnote and the observed thì spelling',()=>{
 const {poems}=bodies('<p>Có câu thì:</p><p>Vua chẳng ra vua, tôi chẳng tôi,</p><p>Bên sông lập miếu cũng hoài thôi.</p><p>Nhưng chỉ có hai câu của nhà thơ: (23)</p><p>Giang đông nhiều tay giỏi,</p><p>Cuốn đất quay về biết đâu.</p>','vi');
 expect(poems).toHaveLength(2);expect(poems.map(p=>p.length)).toEqual([2,2]);
});
it('recognizes a two-line modern rendering after nghĩa là only when it follows a poem',()=>{
 const {poems}=bodies('<p>Có hai câu:</p><p>Sơn hà mây nước cũ,</p><p>Phong nguyệt một tình xưa.</p><p>Nghĩa là:</p><p>Mây sông còn nhớ núi,</p><p>Trăng gió vẫn thương người.</p>','vi');
 expect(poems).toHaveLength(2);expect(poems.map(p=>p.length)).toEqual([2,2]);
 expect(bodies('<p>Ông nói điều ấy nghĩa là:</p><p>Ngày mai ta trở lại.</p><p>Ngày kia sẽ đi xa.</p>','vi').poems).toEqual([]);
});
it('keeps long unformatted verse lines after an explicit genre cue and a said formula',()=>{
 const {poems}=bodies('<p>He composed the following piece:</p><p>It is said:</p><p>The Buddha is compassionate.</p><p>He knows the truth.</p><p>Whoever would rise to lead a lineage in the forest of Chan must strive in devout practice within the realm of the Dharma.</p><p>Peace fills the mountain.</p>','en');
 expect(poems).toHaveLength(1);expect(poems[0]).toHaveLength(4);
});
it('splits numbered plain poem headings without treating them as verse lines',()=>{
 const {e,poems}=bodies('<p>Bức thứ nhất: Mùa vui</p><p>Mây về quanh cửa núi,</p><p>Gió đến trước hiên nhà.</p><p>Trăng lên soi bóng nước,</p><p>Hoa nở đón người xa.</p><p>Bài thứ hai: Mùa nhớ</p><p>Mưa về trên lối nhỏ,</p><p>Nắng tắt phía trời xa.</p><p>Sương phủ mờ đầu ngõ,</p><p>Ai đợi ở hiên nhà.</p>','vi');
 expect(poems.map(p=>p.length)).toEqual([4,4]);expect(e.poems.map(p=>e.text.slice(p.title!.start,p.title!.end))).toEqual(['Bức thứ nhất: Mùa vui','Bài thứ hai: Mùa nhớ']);
});
it('separates a strong title from br and adjacent emphasized lines in one paragraph',()=>{
 const {e,poems}=bodies('<p><strong>Song in Praise of Sleep</strong><br><em>The dream returns at dawn,</em> <em>The world is quiet now.</em></p>','en');
 expect(poems).toEqual([['The dream returns at dawn,','The world is quiet now.']]);expect(e.text.slice(e.poems[0].title!.start,e.poems[0].title!.end)).toBe('Song in Praise of Sleep');
});
it('keeps a colon-ending emphasized verse line inside the same quatrain',()=>{
 const {poems}=bodies('<p><em>Red blooms unfold beside the stream,</em></p><p><em>Lotus fragrance fills the air.</em></p><p><em>These lines recall the words I dreamed:</em></p><p><em>The fragrant memory lingers there.</em></p>','en');
 expect(poems).toHaveLength(1);expect(poems[0]).toHaveLength(4);
});
it('does not append narrative that introduces a quoted name after a couplet',()=>{
 const {poems}=bodies('<p>Có hai câu:</p><p>Bến lạnh cá đớp nguyệt,</p><p>Lũy cổ nhạn kêu sương.</p><p>Vua khen ngợi hồi lâu rồi nhân đó gọi là: "ả Hàn Than".</p>','vi');
 expect(poems).toEqual([['Bến lạnh cá đớp nguyệt,','Lũy cổ nhạn kêu sương.']]);
});
it('excludes a translator credit from verse while preserving the original Reader text',()=>{
 const {e,poems}=bodies('<p>Có bài thơ:</p><p>Mây trôi về nơi bến sông xưa,</p><p>Gió đưa người qua bóng trăng già.</p><p>Trăng sáng in trên dòng nước biếc,</p><p>Suối reo ru những giấc mơ xa.</p><p>Trần thị băng thanh dịch thơ</p>','vi');
 expect(poems[0]).toHaveLength(4);expect(e.text).toContain('Trần thị băng thanh dịch thơ');expect(poems.flat().join('')).not.toContain('dịch thơ');
});
it('does not invent titles from short lines inside an unlabelled song',()=>{
 const {e}=bodies('<p>Người ấy hát bài ca rằng:</p><p>Núi xa mây phủ những tầng cao,</p><p>Suối chảy quanh co suốt đêm thâu.</p><p>Trăng sáng in trên dòng nước biếc,</p><p>Gió đưa hương cỏ đến bên lầu.</p><p>Nhậm tha triều thị</p><p>Nhậm tha xa mã,</p><p>Tri trần bất đáo thử giang san.</p><p>Cỏ biếc hoang vu còn dấu cũ,</p><p>Áo xiêm một thuở đã xa rồi.</p>','vi');
 expect(e.poems).toHaveLength(1);expect(e.poems[0].title).toBeUndefined();
});
it('retains a short rhetorical comma line and records a possible named rendering boundary',()=>{
 const html='<p><strong>Bài ca thích ngủ</strong></p>'+Array.from({length:6},(_,i)=>`<p>Lời thơ xưa vẫn nhớ người ${i},</p>`).join('')+'<p>Thích gì? Ta thích ngủ thôi,</p><p>Mây trời lặng lẽ buông rèm nhớ.</p><p>Suối mát quanh nhà ru giấc mơ.</p><p>Trăng sáng đầu hiên soi bóng cũ.</p><p>Gió đưa hương cỏ đến bên lầu.</p>';
 const {e}=bodies(html,'vi');expect(e.poems).toHaveLength(1);
 const first=e.text.indexOf('Thích gì?');expect(e.poems[0].lines.some(p=>p.start===first)).toBe(true);expect(e.poems[0].renderingBreaks).toContain(first);
});
it('keeps a named verse colon and recognizes the following typed song title',()=>{
 const html='<p>Bài ca thích ngủ</p>'+Array.from({length:4},()=>'<p>Mây trôi về nơi bến sông xưa,</p>').join('')+'<p>Chê khen ai bảo thế nào:</p><p>Đồ lười biếng, bậc thanh cao, mặc lòng.</p><p>Bài ca thích cờ (kỳ)</p>'+Array.from({length:4},()=>'<p>Gió đưa người qua bóng trăng già.</p>').join('');
 const {e}=bodies(html,'vi');expect(e.poems).toHaveLength(2);
 expect(e.poems.map(p=>e.text.slice(p.title!.start,p.title!.end))).toEqual(['Bài ca thích ngủ','Bài ca thích cờ (kỳ)']);
 expect(e.text.slice(e.poems[0].start,e.poems[0].end)).toContain('Chê khen ai bảo thế nào:');
});
it('repairs a double-meter paragraph only when punctuation and surrounding metre support both lines',()=>{
 const intro='<p>Có bài thơ:</p>',lines=Array.from({length:4},()=>'<p>Mây trôi về nơi bến sông xưa,</p>').join('');
 const {poems}=bodies(intro+lines+'<p>Lữ du tư vị cầm tam lộng, Điếu đĩnh sinh nhai tửu nhất tôn.</p>','vi');
 expect(poems[0]).toHaveLength(6);expect(poems[0].slice(-2)).toEqual(['Lữ du tư vị cầm tam lộng,','Điếu đĩnh sinh nhai tửu nhất tôn.']);
 const condensed=bodies(intro+lines+'<p>Mây về bên núi năm xưa, Gió đưa người cũ qua mùa trăng phai.</p>','vi');
 expect(condensed.poems[0]).toHaveLength(5);
});
it('keeps UTF16/NFD/emoji bounds exact and excludes poems inside notes from context input',()=>{
 const html='<p>Có câu thơ:</p><p>😀 Câu đầu nhớ bạn,</p><p>Câu sau đợi người.</p><p>Chú thích:</p><p>(1) Có câu thơ:</p><p><em>Other quoted verse.<br>Another quoted verse.</em></p>';
 const edition=(html:string)=>({html,revision:1,versionId:'00000000-0000-4000-8000-000000000001'});
 const input=makeAlignmentInput('chapter-1',{vi:edition(html),en:edition('<p>Story.</p>')});
 const c=makeContextInput(input);expect(c.structures.vi.poems).toHaveLength(1);
 for(const p of c.structures.vi.poems)for(const l of p.lines)expect(input.editions.vi.text.slice(l.start,l.end).trim()).toBe(input.editions.vi.text.slice(l.start,l.end));
});
