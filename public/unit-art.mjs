// Original 40×40 pixel unit artwork, approved from the standalone preview.
function box(ctx,x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function face(ctx,points,color){
  const ys=points.map(p=>p[1]);
  for(let row=Math.min(...ys);row<Math.max(...ys);row++){
    const hits=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      if((a[1]<=row+.5&&b[1]>row+.5)||(b[1]<=row+.5&&a[1]>row+.5))hits.push(a[0]+(row+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }
    hits.sort((a,b)=>a-b);
    for(let i=0;i+1<hits.length;i+=2){const x=Math.ceil(hits[i]-.5);box(ctx,x,row,Math.ceil(hits[i+1]-.5)-x,1,color);}
  }
}
function rifleman(ctx, p, mech = false) {
  // Three-quarter infantry silhouette, drawn at the map's native pixel scale.
  const outline = "#243b3c", cloth = "#52655a", clothLight = "#83917a";
  const skin = "#e9bc91", skinShadow = "#b78165";
  // Rear pack and its rolled blanket sit behind the left shoulder.
  box(ctx, 7, 15, 8, 11, outline);
  box(ctx, 8, 15, 5, 9, "#65755a");
  box(ctx, 8, 16, 2, 6, "#95a07c");
  box(ctx, 8, 13, 6, 3, outline);
  box(ctx, 9, 13, 4, 2, "#a0a785");
  box(ctx, 10, 14, 1, 10, "#485a4c");
  // Separated, offset legs give the figure a planted combat stance.
  box(ctx, 12, 23, 7, 6, outline);
  box(ctx, 11, 27, 6, 4, outline);
  box(ctx, 13, 24, 4, 4, cloth);
  box(ctx, 12, 27, 3, 3, clothLight);
  box(ctx, 10, 30, 7, 3, outline);
  box(ctx, 11, 30, 4, 1, "#65726a");
  box(ctx, 19, 23, 6, 6, outline);
  box(ctx, 21, 27, 5, 4, outline);
  box(ctx, 20, 24, 3, 3, cloth);
  box(ctx, 22, 27, 2, 3, "#718171");
  box(ctx, 22, 30, 7, 3, outline);
  box(ctx, 23, 30, 4, 1, "#65726a");
  // Uniform shoulders, a fitted vest, and a narrow belt.
  box(ctx, 12, 14, 10, 12, outline);
  box(ctx, 10, 16, 15, 6, outline);
  box(ctx, 12, 15, 9, 9, p[1]);
  box(ctx, 11, 16, 4, 5, p[2]);
  box(ctx, 11, 16, 3, 2, p[0]);
  box(ctx, 21, 16, 3, 4, p[1]);
  box(ctx, 21, 16, 2, 1, p[0]);
  box(ctx, 15, 16, 5, 7, cloth);
  box(ctx, 15, 16, 1, 6, "#b8b591");
  box(ctx, 19, 16, 1, 6, "#b8b591");
  box(ctx, 15, 22, 5, 2, "#8c9271");
  box(ctx, 17, 22, 1, 2, "#40554b");
  box(ctx, 12, 24, 11, 2, outline);
  box(ctx, 17, 24, 2, 1, "#c8bb8b");
  // Neck, shadowed far cheek, and a restrained profile.
  box(ctx, 17, 12, 4, 3, skinShadow);
  box(ctx, 15, 8, 9, 6, outline);
  box(ctx, 16, 9, 7, 4, skin);
  box(ctx, 22, 10, 3, 2, skin);
  box(ctx, 16, 11, 2, 2, skinShadow);
  box(ctx, 21, 10, 1, 1, outline);
  box(ctx, 20, 13, 3, 1, skinShadow);
  // Rounded helmet: broad light cluster, stepped crown, shaded brim.
  box(ctx, 12, 6, 13, 4, outline);
  box(ctx, 14, 4, 9, 2, outline);
  box(ctx, 16, 3, 5, 1, outline);
  box(ctx, 14, 5, 9, 3, p[1]);
  box(ctx, 13, 7, 11, 2, p[1]);
  box(ctx, 16, 4, 5, 2, p[0]);
  box(ctx, 14, 6, 5, 1, p[0]);
  box(ctx, 22, 6, 2, 3, p[2]);
  box(ctx, 12, 9, 14, 2, p[3]);
  box(ctx, 14, 9, 10, 1, p[0]);
  box(ctx, 14, 10, 3, 3, p[2]);
  box(ctx, 22, 11, 1, 1, outline);
  if (mech) {
    // Shoulder-fired launcher, armored shoulder and two spare tubes.
    box(ctx, 6, 14, 3, 12, "#263d3b");
    box(ctx, 6, 15, 2, 9, "#8c9470");
    box(ctx, 9, 16, 3, 11, "#263d3b");
    box(ctx, 9, 17, 2, 8, "#a8a980");
    box(ctx, 11, 16, 6, 5, p[3]);
    box(ctx, 12, 16, 4, 3, p[0]);
    box(ctx, 15, 13, 18, 6, outline);
    box(ctx, 16, 13, 16, 2, "#b1b99a");
    box(ctx, 16, 15, 16, 3, "#64765d");
    box(ctx, 19, 14, 2, 4, "#394f46");
    box(ctx, 28, 14, 2, 4, "#394f46");
    box(ctx, 32, 12, 4, 8, outline);
    box(ctx, 32, 13, 2, 6, "#94a184");
    box(ctx, 35, 14, 1, 4, "#172e30");
    box(ctx, 22, 11, 3, 2, outline);
    box(ctx, 23, 10, 1, 2, "#c6d1b2");
    box(ctx, 12, 20, 6, 3, p[2]);
    box(ctx, 17, 18, 3, 4, skinShadow);
    box(ctx, 18, 18, 2, 3, skin);
    box(ctx, 26, 18, 3, 3, skin);
    box(ctx, 23, 21, 5, 2, p[1]);
  } else {
  // Rifle across the body: stock, receiver, forward grip and slender barrel.
  box(ctx, 15, 19, 6, 3, outline);
  box(ctx, 16, 19, 4, 2, "#946e4f");
  box(ctx, 20, 18, 10, 3, outline);
  box(ctx, 22, 18, 6, 1, "#7f918a");
  box(ctx, 28, 17, 6, 2, outline);
  box(ctx, 32, 16, 1, 2, outline);
  box(ctx, 23, 21, 3, 3, outline);
  box(ctx, 23, 21, 1, 2, "#61766c");
  // Both arms connect to the weapon, keeping the pose readable at 1×.
  box(ctx, 12, 20, 4, 3, p[2]);
  box(ctx, 14, 21, 5, 2, p[1]);
  box(ctx, 18, 20, 3, 2, skin);
  box(ctx, 25, 20, 3, 2, skinShadow);
  box(ctx, 25, 19, 3, 2, skin);
  }
}


function lightTank(ctx,p){
      // Rasterize flat faces at native resolution: crisp pixel clusters at any DPR.
      const face = (points, color) => {
        const ys = points.map(pt => pt[1]);
        for (let row = Math.min(...ys); row < Math.max(...ys); row++) {
          const hits = [];
          for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            if ((a[1] <= row + .5 && b[1] > row + .5) ||
                (b[1] <= row + .5 && a[1] > row + .5))
              hits.push(a[0] + (row + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
          }
          hits.sort((a, b) => a - b);
          for (let i = 0; i + 1 < hits.length; i += 2) {
            const start = Math.ceil(hits[i] - .5);
            box(ctx, start, row, Math.ceil(hits[i + 1] - .5) - start, 1, color);
          }
        }
      };
      const dark = "#23383b", tread = "#34474a", rim = "#778783";
      // Far track and rear plate sit behind a sloped, low-slung hull.
      face([[11,15],[29,17],[36,21],[35,26],[31,28],[11,22]], dark);
      face([[29,19],[35,22],[34,26],[31,27],[29,24]], tread);
      box(ctx, 33, 23, 1, 3, rim);
      face([[5,19],[12,15],[32,19],[35,22],[27,28],[5,24]], p[3]);
      face([[5,18],[12,14],[31,18],[35,21],[27,25],[4,21]], dark);
      face([[6,18],[12,15],[30,19],[32,21],[26,23],[6,20]], p[0]);
      face([[6,20],[26,24],[26,28],[5,24]], p[2]);
      face([[26,24],[34,21],[34,25],[27,29],[26,28]], p[3]);
      face([[27,24],[33,22],[32,25],[27,27]], p[1]);
      // Two broad planes read at 1×; seams use restrained highlights.
      face([[8,19],[25,22],[27,21],[13,17]], p[1]);
      face([[7,21],[24,24],[24,25],[7,22]], p[0]);
      // Near track follows the same diagonal perspective as the armor.
      face([[5,23],[26,27],[28,29],[26,33],[6,29],[3,26]], dark);
      face([[6,24],[25,28],[26,30],[25,32],[6,28],[4,26]], tread);
      face([[6,24],[25,28],[25,29],[6,25]], rim);
      for (const [wx, wy] of [[7,25],[12,26],[17,27],[22,28]]) {
        box(ctx, wx, wy, 3, 3, "#182e32");
        box(ctx, wx, wy, 2, 2, "#6b7d79");
        box(ctx, wx, wy, 1, 1, "#a2ada0");
      }
      face([[6,28],[25,32],[25,33],[6,29]], "#4f6463");
      // Rear deck grille: aligned slats, no scattered decorative pixels.
      face([[8,18],[12,16],[16,17],[12,20]], p[3]);
      box(ctx, 10, 18, 3, 1, "#85938a");
      box(ctx, 12, 17, 2, 1, "#85938a");
      // Small cast turret with a clipped nose and visible lower side.
      face([[15,11],[22,10],[28,13],[29,17],[25,21],[14,19],[11,16]], dark);
      face([[15,12],[22,11],[27,14],[26,17],[15,17],[12,15]], p[0]);
      face([[12,15],[15,17],[26,18],[25,20],[15,18],[12,17]], p[2]);
      face([[15,13],[22,12],[25,14],[24,16],[16,16],[14,15]], p[1]);
      face([[25,14],[28,14],[28,17],[25,19],[24,17]], p[3]);
      // Flat oval hatch catches the shared top-left light.
      box(ctx, 17, 12, 5, 3, p[3]);
      box(ctx, 18, 12, 4, 2, "#eddbac");
      box(ctx, 18, 13, 3, 1, p[2]);
      // Fine cannon aimed diagonally forward, with a subdued steel muzzle.
      face([[25,14],[36,11],[38,12],[38,14],[28,18],[25,17]], dark);
      face([[26,14],[36,12],[37,13],[27,16]], p[0]);
      face([[27,16],[37,13],[37,14],[28,17]], p[2]);
      box(ctx, 36, 12, 2, 2, "#526561");
      box(ctx, 37, 12, 1, 2, dark);
      // Radio and a single warm headlamp complete the silhouette.
      box(ctx, 12, 7, 1, 7, dark);
      box(ctx, 12, 7, 1, 1, "#d5d9bd");
      box(ctx, 29, 23, 2, 2, "#f4dda7");
      box(ctx, 7, 22, 2, 1, "#e4cc98");

}

function trackHull(ctx,p,wide=false){
  const f=(pts,c)=>face(ctx,pts,c), ink='#23383b';
  f([[10,15],[30,17],[37,21],[36,27],[31,30],[9,24]],ink);
  f([[30,21],[36,23],[35,27],[31,29]],'#4e635f');
  f([[5,18],[12,14],[30,18],[36,22],[27,27],[4,22]],ink);
  f([[6,18],[12,15],[30,19],[33,22],[26,25],[5,21]],p[0]);
  f([[5,21],[26,25],[27,29],[5,25]],p[2]);
  f([[26,25],[35,22],[34,27],[27,30]],p[3]);
  f([[5,24],[26,28],[29,30],[26,34],[5,30],[2,27]],ink);
  f([[5,25],[26,29],[27,31],[25,33],[5,29],[3,27]],'#465b58');
  f([[6,25],[25,29],[25,30],[6,26]],'#9ca793');
  for(const [x,y] of [[6,26],[11,27],[16,28],[21,29]]){
    box(ctx,x,y,3,3,'#1c3234');box(ctx,x,y,2,2,'#879585');
  }
  if(wide){
    f([[4,22],[26,26],[28,29],[5,25]],p[3]);
    f([[5,22],[26,26],[26,28],[5,24]],p[1]);
    for(const [x,y] of [[8,23],[14,24],[20,25]])box(ctx,x,y,1,2,p[3]);
  }
}
function tire(ctx,x,y){
  box(ctx,x+1,y,5,8,'#223638');box(ctx,x,y+2,7,4,'#223638');
  box(ctx,x+2,y+2,3,4,'#6f817b');box(ctx,x+2,y+2,2,2,'#abb59e');
  box(ctx,x+3,y+3,1,2,'#314a48');
}
function recon(ctx,p){
  const f=(pts,c)=>face(ctx,pts,c), ink='#23383b';
  tire(ctx,26,21);
  f([[5,20],[15,15],[33,21],[35,26],[28,30],[6,25]],ink);
  f([[6,19],[15,15],[33,21],[29,26],[6,23]],p[1]);
  f([[6,22],[28,27],[28,29],[6,25]],p[2]);
  f([[27,25],[34,22],[34,26],[28,29]],p[3]);
  // A tall cab and a short hood distinguish the reconnaissance jeep.
  f([[10,12],[18,10],[25,13],[26,22],[11,19],[8,16]],ink);
  f([[11,12],[18,11],[24,13],[18,16],[9,14]],p[0]);
  f([[10,15],[17,17],[17,21],[11,19]],'#3a6468');
  f([[11,15],[16,17],[16,18],[11,17]],'#b4d3c1');
  f([[18,16],[24,14],[25,19],[18,22]],'#315157');
  f([[19,17],[23,16],[24,18],[19,20]],'#91beb2');
  box(ctx,21,16,1,4,ink);
  f([[18,22],[25,19],[34,22],[28,26]],p[0]);
  f([[20,22],[25,20],[32,22],[28,24]],p[1]);
  box(ctx,27,26,3,1,'#f2db9f');box(ctx,32,24,2,1,'#f2db9f');
  f([[29,28],[34,26],[34,28],[29,30]],'#829288');
  tire(ctx,7,24);tire(ctx,23,27);
  box(ctx,7,11,1,9,ink);box(ctx,7,9,1,2,'#bfc5a6');
  box(ctx,12,21,3,1,p[0]);
}
function heavyTank(ctx,p){
  const f=(pts,c)=>face(ctx,pts,c), ink='#23383b';trackHull(ctx,p,true);
  // Broad reinforced turret is visibly larger than the light tank's.
  f([[12,10],[22,8],[29,12],[30,18],[24,23],[10,20],[8,15]],ink);
  f([[12,11],[22,9],[28,13],[25,17],[12,16],[9,14]],p[0]);
  f([[10,15],[24,19],[24,22],[11,19]],p[2]);
  f([[24,18],[29,14],[29,18],[24,22]],p[3]);
  f([[14,12],[21,10],[25,13],[23,16],[13,15]],p[1]);
  box(ctx,16,11,6,3,p[3]);box(ctx,17,11,4,2,'#b4b896');
  f([[24,14],[27,12],[30,14],[29,19],[25,21]],p[3]);
  f([[27,15],[35,12],[38,13],[38,17],[29,20]],ink);
  f([[28,15],[35,13],[37,14],[29,17]],p[0]);
  f([[29,17],[37,14],[37,17],[29,19]],p[2]);
  box(ctx,35,13,3,4,'#435955');box(ctx,37,14,1,2,'#152f32');
  f([[7,18],[12,19],[12,21],[7,20]],'#b2b79a');
  box(ctx,12,20,4,2,p[3]);box(ctx,18,21,4,2,p[3]);
  box(ctx,29,25,2,2,'#f5d79b');box(ctx,32,24,2,2,'#f5d79b');
  box(ctx,11,7,1,5,ink);
}
function artillery(ctx,p){
  const f=(pts,c)=>face(ctx,pts,c), ink='#23383b';trackHull(ctx,p);
  // Low open fighting compartment and a steeply elevated long gun.
  f([[8,16],[17,13],[25,17],[25,24],[10,22]],ink);
  f([[9,16],[17,14],[23,17],[17,19]],p[0]);
  f([[10,17],[17,15],[22,17],[17,18]],'#344d47');
  f([[9,17],[17,20],[17,23],[10,21]],p[1]);
  f([[17,20],[24,17],[24,23],[18,25]],p[2]);
  box(ctx,19,17,7,6,ink);box(ctx,20,18,5,3,'#64796b');
  f([[21,17],[29,6],[33,5],[35,8],[26,21]],ink);
  f([[22,17],[30,7],[32,7],[24,19]],'#d2ceaa');
  f([[24,19],[32,7],[34,8],[26,20]],p[2]);
  f([[29,5],[32,4],[36,7],[35,10],[31,9]],ink);
  f([[30,5],[32,5],[35,7],[34,8]],'#829284');
  box(ctx,33,7,2,1,'#1b3232');
  box(ctx,19,20,2,3,'#aab092');
  box(ctx,8,18,1,4,p[3]);
  f([[7,23],[14,25],[14,26],[7,24]],p[0]);
  box(ctx,29,24,3,2,'#e0ce97');
}
function truckBase(ctx,p){
  const f=(pts,c)=>face(ctx,pts,c), ink='#23383b';
  tire(ctx,29,23);
  f([[3,20],[13,15],[35,21],[37,27],[29,32],[4,26]],ink);
  f([[4,20],[13,16],[35,22],[29,27],[4,23]],p[0]);
  f([[4,23],[29,28],[29,31],[4,27]],p[2]);
  f([[29,27],[36,23],[36,27],[29,32]],p[3]);
  tire(ctx,5,24);tire(ctx,13,26);tire(ctx,25,28);
  f([[23,17],[29,14],[35,18],[36,24],[29,28],[23,24]],ink);
  f([[24,17],[29,15],[34,18],[29,21]],p[0]);
  f([[24,18],[28,21],[28,25],[24,23]],p[1]);
  f([[29,21],[34,18],[35,23],[29,26]],'#31545a');
  f([[30,21],[33,19],[34,22],[30,24]],'#a2c7b6');
  f([[29,26],[36,23],[36,27],[30,30]],p[1]);
  box(ctx,30,27,2,2,'#f0d9a1');box(ctx,34,25,2,2,'#f0d9a1');
}
function rocket(ctx,p){
  const f=(pts,c)=>face(ctx,pts,c), ink='#23383b';truckBase(ctx,p);
  box(ctx,13,18,6,5,ink);box(ctx,14,18,4,3,'#718272');
  // Wide, six-port launcher rack; the cabin stays visible below and ahead.
  f([[4,14],[16,4],[27,7],[27,14],[16,23],[4,20]],ink);
  f([[5,14],[16,5],[26,8],[15,18]],p[0]);
  f([[5,15],[15,18],[15,22],[5,19]],p[2]);
  f([[15,18],[26,9],[26,14],[16,22]],p[3]);
  for(let i=0;i<3;i++){
    const x=6+i*3;
    f([[x,14],[x+10,6],[x+12,7],[x+2,16]],'#71856d');
    f([[x,14],[x+10,6],[x+11,6],[x+1,15]],'#c9c9a0');
  }
  // Separate launch openings, arranged on the sloping front plate.
  for(const [x,y] of [[17,16],[20,13],[23,10]]){
    box(ctx,x,y,2,2,'#c9ceac');box(ctx,x+1,y,1,2,ink);
    box(ctx,x,y+3,2,2,'#c9ceac');box(ctx,x+1,y+3,1,2,ink);
  }
  box(ctx,25,15,1,3,p[0]);
}
function supply(ctx,p){
  const f=(pts,c)=>face(ctx,pts,c), ink='#23383b';trackHull(ctx,p);
  // A full-length protected troop bay, with an integrated sloped driving nose.
  f([[5,13],[14,8],[27,11],[35,18],[35,24],[26,29],[5,24]],ink);
  f([[6,13],[14,9],[26,12],[31,17],[23,21]],p[0]);
  f([[6,14],[23,21],[24,27],[6,23]],p[1]);
  f([[23,21],[31,17],[34,20],[33,24],[25,28]],p[2]);
  f([[7,22],[24,26],[24,28],[6,24]],p[3]);
  // Broad roof hatch makes the enclosed passenger compartment legible.
  f([[13,12],[18,10],[25,13],[20,17],[13,15]],p[3]);
  f([[14,12],[18,11],[24,13],[20,16],[14,14]],p[1]);
  f([[15,12],[18,11],[23,13],[21,14]],p[0]);
  box(ctx,18,13,3,1,'#e9d7ad');
  box(ctx,16,15,2,1,p[3]);
  // Driver hatch and narrow vision blocks, not a glass truck windshield.
  f([[25,14],[28,14],[31,17],[28,19],[25,17]],p[3]);
  f([[26,14],[28,15],[30,17],[28,18],[26,16]],p[1]);
  f([[25,19],[28,18],[29,19],[26,21]],ink);
  f([[30,17],[32,19],[31,20],[29,18]],ink);
  box(ctx,26,19,2,1,'#9fbdb0');
  // Rear boarding door, hinge and fold-down step on the visible quarter.
  f([[7,15],[13,17],[13,24],[7,23]],p[3]);
  f([[8,16],[12,18],[12,23],[8,22]],p[2]);
  box(ctx,8,18,1,3,p[0]);
  box(ctx,11,20,1,2,'#e8d7af');
  box(ctx,7,23,6,1,'#b0b69e');
  box(ctx,8,24,4,1,ink);
  // Two side viewing ports and side armor seams suggest occupied cabin space.
  box(ctx,15,19,3,2,p[3]);box(ctx,19,20,3,2,p[3]);
  box(ctx,15,19,2,1,'#a7c0ac');box(ctx,19,20,2,1,'#a7c0ac');
  f([[15,23],[22,25],[22,26],[15,24]],p[0]);
  // Small external stowage leaves the troop roof and boarding door unobstructed.
  f([[5,11],[9,9],[13,11],[13,14],[9,16],[5,14]],ink);
  f([[6,11],[9,10],[12,11],[9,13]],'#d4bb87');
  f([[6,12],[9,14],[9,15],[6,14]],'#9a8057');
  f([[9,13],[12,12],[12,14],[9,15]],'#776647');
  box(ctx,8,11,1,3,'#eee0b3');
  box(ctx,3,16,3,6,ink);box(ctx,3,17,2,4,'#8c9b77');
  box(ctx,4,16,1,1,'#d0cba2');
  // Tow point, headlights and a folded aerial complete the unarmed silhouette.
  box(ctx,29,23,2,2,'#f1dba9');box(ctx,32,21,2,2,'#f1dba9');
  box(ctx,29,26,2,1,'#8e9b87');
  box(ctx,12,7,1,5,ink);box(ctx,12,6,1,1,'#b7bea0');
}

/** Aircraft are drawn top-down in the same 40 px frame as everything else. */
function fighter(ctx, p) {
  const ink = "#23383b";
  // Long swept wing with a pointed nose, so direction reads at a glance.
  face(ctx, [[20,2],[24,12],[23,22],[34,26],[35,31],[23,29],[22,38],[18,38],[17,29],[5,31],[6,26],[17,22],[16,12]], ink);
  face(ctx, [[20,4],[22,13],[21,22],[32,27],[33,29],[21,28],[20,36],[20,28],[8,29],[9,27],[18,22],[18,13]], p[2]);
  face(ctx, [[20,5],[21,14],[20,22],[9,27],[20,27]], p[0]);
  face(ctx, [[20,24],[31,28],[20,28]], p[1]);
  box(ctx, 19, 8, 2, 12, "#b9c8bd");
  box(ctx, 20, 6, 1, 4, "#e7e2c4");
  // Canopy and twin tail fins.
  box(ctx, 18, 16, 5, 5, ink);
  box(ctx, 19, 17, 3, 3, "#a7c7b7");
  box(ctx, 16, 34, 3, 5, p[3]);
  box(ctx, 22, 34, 3, 5, p[3]);
  box(ctx, 17, 35, 1, 3, p[0]);
  box(ctx, 23, 35, 1, 3, p[0]);
}
function bomber(ctx, p) {
  const ink = "#23383b";
  // Blunt flying wing; heavier than the fighter and visibly wider.
  face(ctx, [[20,3],[25,9],[27,20],[37,24],[37,30],[26,28],[24,36],[16,36],[14,28],[3,30],[3,24],[13,20],[15,9]], ink);
  face(ctx, [[20,5],[24,10],[25,20],[35,25],[35,28],[24,26],[22,34],[18,34],[16,26],[5,28],[5,25],[15,20],[16,10]], p[2]);
  face(ctx, [[20,6],[23,11],[23,20],[6,25],[20,25]], p[0]);
  face(ctx, [[21,22],[34,26],[21,26]], p[1]);
  // Glass nose and four engine pods under the wing.
  box(ctx, 18, 7, 5, 6, ink);
  box(ctx, 19, 8, 3, 4, "#9fbfb2");
  for (const [x, y] of [[9, 24], [13, 25], [27, 25], [31, 24]]) {
    box(ctx, x, y, 3, 4, ink);
    box(ctx, x + 1, y, 1, 3, "#8d9a89");
  }
  box(ctx, 19, 30, 2, 5, p[3]);
}
function helicopter(ctx, p) {
  const ink = "#23383b";
  // Fenestrated fuselage with a long tail boom and a top rotor cross.
  face(ctx, [[13,14],[26,14],[29,19],[28,27],[24,31],[13,31],[10,26],[10,19]], ink);
  face(ctx, [[14,15],[25,15],[27,19],[26,26],[23,29],[14,29],[11,26],[11,19]], p[1]);
  face(ctx, [[14,16],[24,16],[24,21],[14,21]], p[0]);
  // Cabin glass and sliding door.
  box(ctx, 15, 17, 7, 5, "#a7c7b7");
  box(ctx, 16, 18, 5, 3, "#cfe3d8");
  box(ctx, 23, 18, 3, 7, p[3]);
  box(ctx, 24, 19, 1, 5, ink);
  // Tail boom and tail rotor.
  face(ctx, [[13,28],[18,32],[12,36],[9,33]], p[1]);
  box(ctx, 9, 32, 3, 5, ink);
  box(ctx, 8, 33, 1, 3, "#d8d3b4");
  box(ctx, 11, 33, 4, 1, "#c8c3a4");
  // Main rotor: hub plus four translucent blades.
  box(ctx, 19, 18, 3, 3, "#3a4b47");
  box(ctx, 1, 19, 17, 1, "#b9c8bd");
  box(ctx, 23, 19, 17, 1, "#b9c8bd");
  box(ctx, 20, 6, 1, 12, "#b9c8bd");
  box(ctx, 20, 22, 1, 12, "#b9c8bd");
  box(ctx, 18, 12, 6, 2, p[3]);
}
/** Ships sit low in the frame: hull, deck line and a small superstructure. */
function destroyer(ctx, p) {
  const ink = "#23383b";
  // Long wedge hull, bow at the top.
  face(ctx, [[20,3],[27,17],[26,35],[14,35],[13,17]], ink);
  face(ctx, [[20,5],[25,18],[24,33],[16,33],[15,18]], p[2]);
  face(ctx, [[20,6],[24,19],[16,19],[20,6]], p[0]);
  face(ctx, [[20,24],[25,20],[24,32],[16,32],[15,20]], p[1]);
  // Deck superstructure, funnel and turret.
  face(ctx, [[16,12],[24,12],[26,18],[14,18]], p[3]);
  face(ctx, [[17,13],[23,13],[24,17],[16,17]], p[1]);
  box(ctx, 19, 8, 2, 5, "#8d9a89");
  box(ctx, 18, 7, 4, 2, "#c6c9a9");
  box(ctx, 18, 19, 4, 4, ink);
  box(ctx, 19, 20, 2, 2, "#aab59c");
  box(ctx, 19, 22, 1, 6, "#d8d3b4");
  // Depth charges and railings along the stern.
  box(ctx, 15, 29, 3, 2, "#4a5c54");
  box(ctx, 22, 29, 3, 2, "#4a5c54");
  box(ctx, 14, 33, 12, 1, "#7f8e84");
}
function lander(ctx, p) {
  const ink = "#23383b";
  // Blunt bow ramp: this is a barge, not a warship.
  face(ctx, [[13,4],[27,4],[30,12],[29,35],[11,35],[10,12]], ink);
  face(ctx, [[14,5],[26,5],[28,13],[27,33],[13,33],[12,13]], p[2]);
  face(ctx, [[14,6],[26,6],[28,13],[12,13]], p[0]);
  face(ctx, [[13,16],[27,16],[27,32],[13,32]], p[1]);
  // The vehicle deck with two guide lanes and a raised ramp lip.
  box(ctx, 15, 17, 3, 14, "#8f9a89");
  box(ctx, 22, 17, 3, 14, "#8f9a89");
  box(ctx, 17, 20, 6, 9, "#77876f");
  box(ctx, 12, 14, 16, 2, "#a8a284");
  // Small bridge block and the ramp hinge on the bow.
  box(ctx, 17, 28, 6, 5, p[3]);
  box(ctx, 18, 29, 4, 3, p[1]);
  box(ctx, 12, 5, 16, 2, "#8d9a89");
  box(ctx, 19, 2, 2, 3, ink);
}

export function paintUnitArtwork(ctx, type, palette) {
  switch (type) {
    case "infantry": return rifleman(ctx, palette);
    case "mech": return rifleman(ctx, palette, true);
    case "recon": return recon(ctx, palette);
    case "tank": return lightTank(ctx, palette);
    case "heavy": return heavyTank(ctx, palette);
    case "artillery": return artillery(ctx, palette);
    case "rocket": return rocket(ctx, palette);
    case "apc": return supply(ctx, palette);
    case "fighter": return fighter(ctx, palette);
    case "bomber": return bomber(ctx, palette);
    case "heli": return helicopter(ctx, palette);
    case "destroyer": return destroyer(ctx, palette);
    case "lander": return lander(ctx, palette);
    default: return rifleman(ctx, palette);
  }
}
