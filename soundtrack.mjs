const main = document.querySelector('main');
const qs = document.querySelector.bind(document);
const qsa = document.querySelectorAll.bind(document);
const create = function(innerText){
  const temp = document.createElement('div');
  temp.innerHTML = innerText;
  return temp.firstChild;
}

class App {
  #ui = {
    search: {
      clear:    qs('.clear.search'),
      text:     qs('.search.text'),
      types: {
        artist: qs('.search.option.artist'),
        album:  qs('.search.option.album'),
        song:   qs('.search.option.song'),
        get checked(){
          return qs('.search.option:checked')
        }
      }
    },
    playlist:   qs('.playlist'),
    outputs: {
      audio:    qs('.track'),
      artist:   qs('.current.artist'),
      album:    qs('.current.album'),
      cd:       qs('.current.cd'),
      track:    qs('.current.track'),
      song:     qs('.current.song'),
    },
    controls: {
      previous: qs('.control.previous'),
      play:     qs('.control.play'),
      pause:    qs('.control.pause'),
      next:     qs('.control.next'),
      shuffle:  qs('.control.shuffle'),
      progress: qs('.progress')
    },
    time:       qs('.time-overview'),
    toggleMenu:       qs('.toggle.menu'),
    menuOpens:   qsa('.menu.open')
  };

  #playlist = new Playlist(this.#ui);

  constructor(){
    const audio = this.#ui.outputs.audio;
    const progress = this.#ui.controls.progress;

    audio.addEventListener('ended', () => {
      this.#playlist.currentTrack.state = Track.STATES.stopped;
      this.#playlist.nextTrack();
    });
    audio.ondurationchange = () => audio.duration ? progress.max = audio.duration : null;
    audio.ontimeupdate = () => {
      progress.value = audio.currentTime;
      const currentTime = App.formatSeconds(audio.currentTime);
      const totalTime   = App.formatSeconds(audio.duration);
      this.#ui.time.value = `${currentTime}/${totalTime}`;
    };

    this.#ui.menuOpens.forEach(mo => mo.onclick = () => this.#playlist.addDirectory());

    this.#ui.search.clear.onclick         = () => this.#clearSearch();
    this.#ui.search.text.onkeyup          = () => this.#playlist.filter();
  
    this.#ui.search.types.artist.addEventListener('change', 
      () => this.#playlist.setFilter(this.#ui.search.text.value, 'artist'));
    this.#ui.search.types.album.addEventListener('change', 
      () => this.#playlist.setFilter(this.#ui.search.text.value, 'album'));
    this.#ui.search.types.song.addEventListener('change', 
      () => this.#playlist.setFilter(this.#ui.search.text.value, 'song'));

    this.#ui.controls.previous.onclick    = () => this.#playlist.previousTrack();
    this.#ui.controls.play.onclick        = () => this.#playlist.play();
    this.#ui.controls.pause.onclick       = () => this.#playlist.pauseTrack();
    this.#ui.controls.next.onclick        = () => this.#playlist.nextTrack();
    this.#ui.controls.shuffle.onclick     = () => this.#playlist.toggleShuffle();
    this.#ui.controls.progress.onclick    = (e) => {
      const width = e.target.offsetWidth;
      const click = e.offsetX;
      const fraction = click / width;
      this.#ui.outputs.audio.currentTime = audio.duration * fraction;
    }

    navigator.mediaSession.setActionHandler('previoustrack', () => this.#playlist.previousTrack());
    navigator.mediaSession.setActionHandler('play',          () => this.#playlist.playTrack());
    navigator.mediaSession.setActionHandler('pause',         () => this.#playlist.pause());
    navigator.mediaSession.setActionHandler('nexttrack',     () => this.#playlist.nextTrack());

    this.#ui.toggleMenu.onclick = () => qs('.menu.view').classList.toggle('hide');
  }

  #clearSearch(){
    this.#ui.search.text.value = '';
    this.#playlist.filter();
  }

  static formatSeconds(s){
    s = parseInt(s);
    let hours = Math.floor(s / 3600);
    let minutes = Math.floor((s - (hours * 3600)) / 60);
    let seconds = s - (hours * 3600) - (minutes * 60);

    if(hours < 10) hours = "0" + hours;
    if(minutes < 10) minutes = "0" + minutes;
    if(seconds < 10) seconds = "0" + seconds;

    return `${hours !== "00" ? hours + ":" : ""}${minutes}:${seconds}`;
  }
}

class LabelMaker {
  static makeLabels(tags){
    const label = ``.concat(
      tags.artist ?? `Unknown Artist`,
      tags.album ? ` - ${tags.album}` : ` - Unknown Album`,
      tags.TPOS?.data ? ` - ${tags.TPOS.data}` : ``,
      tags.track ? ` - ${tags.track}` : ``,
      ` - ${tags.title ?? "Unknown Song"}`
    )

    const labels = {}
    labels[Track.STATES.stopped] = label;
    labels[Track.STATES.playing] = `⏵︎ ${label}`;
    labels[Track.STATES.paused]  = `⏸︎ ${label}`;

    return labels;
  }
}

class Playlist {
  //#region Playlist Properties
  #tracks = [];

  currentTrack = null;
  #shuffling = false;
  #albumCovers = new Map();
  ui = null;

  #newId = -1;
  //#endregion

  static SCROLL_OPTIONS = {
    block: "start",
    inline: "nearest",
    behavior: "smooth"
  };

  constructor(ui){
    this.ui = ui;
  }

  previousTrack(){
    const audio = this.ui.outputs.audio;
    if(audio.currentTime >= 1.0) audio.currentTime = 0;
    else{
      this.currentTrack?.stop();
      const previousIndex = this.currentTrack?.entry.previousElementSibling?.dataset.trackIndex;
      if(previousIndex) this.playTrack(this.#tracks[previousIndex]);
    }
  }

  play(){
    switch(this.currentTrack?.state){
      case 'paused':
        this.currentTrack.continue();
        this.ui.controls.play.hidden = false;
        this.ui.controls.pause.hidden = true;
        break;

      case 'playing':
        this.currentTrack.pause();
        this.ui.controls.play.hidden = true;
        this.ui.controls.pause.hidden = false;
        break;

      default:
        const currentEntry = this.ui.playlist.firstElementChild;
        const currentTrack = this.#tracks[currentEntry.dataset.trackIndex]
        this.playTrack(currentTrack);
        this.ui.controls.play.hidden = true;
        this.ui.controls.pause.hidden = false;
        break;
    }
  }

  playTrack(track){
    this.ui.controls.play.hidden = true;
    this.ui.controls.pause.hidden = false;

    this.currentTrack?.stop();
    track?.play();
    this.currentTrack = track;
  }

  pauseTrack(){
    this.currentTrack?.pause();
    this.ui.controls.pause.hidden = true;
    this.ui.controls.play.hidden = false;
  }

  nextTrack(){
    this.currentTrack?.stop();
    let nextIndex;

    if(this.#shuffling){
      nextIndex = Math.floor(Math.random() * this.ui.playlist.children.length); 
    }else{
      nextIndex = this.currentTrack?.entry.nextElementSibling?.dataset.trackIndex;
    }

    if(nextIndex) this.playTrack(this.#tracks[nextIndex]);
    this.currentTrack.entry.scrollIntoView(Playlist.SCROLL_OPTIONS);
  }

  toggleShuffle(){
    if(this.#shuffling){
      this.ui.controls.shuffle.classList.remove('active');
      this.#shuffling = false;
    }else{
      this.ui.controls.shuffle.classList.add('active');
      this.#shuffling = true;
    }
  }

  addDirectory(){
    const input = create('<input type="file" webkitdirectory multiple>');
    input.onchange = () => {
      const max = input.files.length;
      let i = 0;
      Promise.all(Array.from(input.files).map(async (f, ) => {
        await this.addFile(f)
        this.ui.controls.progress.max = max;
        this.ui.controls.progress.value = i++;
        this.ui.time.value = `${i}/${input.files.length}`;
      })).then(() => {
        this.ui.controls.progress.value = 0;
        this.setFilter('', 'artist')
      });
    }

    if('showPicker' in HTMLInputElement.prototype) input.showPicker();
    else input.click();

    qs('.load-directory').hidden = true;
  }

  addFile(file){
    if(file.name.endsWith('folder.jpg')) return this.addCover(file);
    if(file.name.endsWith('.mp3')) return this.addTrack(file);
  }

  addCover(file){
    let path = file.webkitRelativePath.split('/').slice(0, -1).join('/');
    this.#albumCovers.set(path, file);
  }

  async addTrack(file){
    const track = new Track(++this.#newId, file, this);
    await track.readTags();
    this.#tracks.push(track);
    return track;
  }

  clearFilter(){
    this.ui.search.text.value = '';
    this.filter();
  }

  setFilter(term, type){
    this.ui.search.text.value = term;
    this.ui.search.types.checked.checked = false;
    this.ui.search.types[type].checked = true;

    this.filter();
  }

  filter(){
    const term = this.ui.search.text.value.toLowerCase();
    const prop = this.ui.search.types.checked.value;

    this.ui.playlist.innerHTML = '';
    this.ui.playlist.append(...this.#tracks
      .filter(track => track.tags[prop]?.toLowerCase()?.includes(term))
      .sort((trackA, trackB) => this.#sortingFn(trackA.tags, trackB.tags))
      .map(track => {
        const entry = track.entry;

        entry.classList.remove('current');
        if(this.currentTrack === track) entry.classList.add('current');       

        return entry;
      }));

    this.currentTrack?.entry.classList.add('current');
    this.currentTrack?.entry.scrollIntoView(Playlist.SCROLL_OPTIONS);
  }

  #sortingFn(a, b){
    if(a.artist !== b.artist){
      if(a.artist.toLowerCase() < b.artist.toLowerCase()) return -1;
      if(a.artist.toLowerCase() > b.artist.toLowerCase()) return 1;
    }
    if(a.year !== b.year){
      return parseInt(a.year) - parseInt(b.year);
    }
    if(a.album !== b.album){
      // more lowercases?
      if(a.album < b.album) return -1;
      if(a.album > b.album) return 1;
    }

    a.cd = a.TPOS?.data;
    b.cd = b.TPOS?.data;
    if(a.cd !== b.cd){
      try{
        return parseInt(a.cd) - parseInt(b.cd);
      }catch(_){
        if(a.cd < b.cd) return -1;
        if(a.cd > b.cd) return 1;
      }
    }
    if(a.track !== b.track){
      try{
        return parseInt(a.track) - parseInt(b.track);
      }catch(_){
        if(a.track < b.track) return -1;
        if(a.track > b.track) return 1;
      }
    }
    if(a.title !== b.title){
      if(a.title < b.title) return -1;
      if(a.title > b.title) return 1;
    }
    return 0;
  }
}

class Track {
  static STATES = {
    playing: 'playing',
    paused: 'paused',
    stopped: 'stopped'
  }

  //#region Track Properties
  id = null
  #playlist = null;

  #file = null;
  #tagReader = window.jsmediatags;
  tags = null;
  #state = Track.STATES.stopped; // | "playing" | "paused"
  #labels = {stopped: '', playing: '', paused: ''};
  #entry = null;
  //#endregion

  constructor(id, file, playlist){
    this.id = id;
    this.#file = file;
    this.#playlist = playlist;
  }

  play(){
    if(this.state === Track.STATES.stopped){
      const trackReader = new FileReader();
      trackReader.onload = () => {
        this.#playlist.ui.controls.progress.value = 0.0;
        this.#playlist.ui.outputs.audio.src = trackReader.result;
        this.#playlist.ui.outputs.audio.play();
        this.state = Track.STATES.playing;
        this.setInfo();
      };
      trackReader.readAsDataURL(this.#file);
    }else if(this.state === Track.STATES.paused){
      this.continue();
    }
  }

  resetInfo(){
    this.#playlist.ui.outputs.artist.value  = ``;
    this.#playlist.ui.outputs.album.value   = ``;
    this.#playlist.ui.outputs.cd            = ``;
    this.#playlist.ui.outputs.track.value   = ``;
    this.#playlist.ui.outputs.song.value    = ``;   
  }

  setInfo(){
    this.resetInfo();
    const cd = this.tags.TPOS?.data;
    this.#playlist.ui.outputs.artist.value  = this.tags.artist ?? `Unknown Artist`;
    this.#playlist.ui.outputs.album.value   = this.tags.album ? `- ${this.tags.album}` : ` - Unknown Album`;
    this.#playlist.ui.outputs.cd            = cd ? ` - ${cd}` : ``;
    this.#playlist.ui.outputs.track.value   = this.tags.track ? ` - ${this.tags.track}` : ``;
    this.#playlist.ui.outputs.song.value    = this.tags.title ? `- ${this.tags.title}` : ` - Unknown Title`;

    this.#playlist.ui.outputs.artist.onclick = () => this.#playlist.setFilter(this.tags.artist, 'artist');
    this.#playlist.ui.outputs.album.onclick  = () => this.#playlist.setFilter(this.tags.album, 'album');
  }

  pause(){
    this.#playlist.ui.outputs.audio.pause();
    this.state = Track.STATES.paused;
  }

  continue(){
    this.ui.controls.play.hidden = true;
    this.ui.controls.pause.hidden = false;
    this.#playlist.ui.outputs.audio.play();
    this.state = Track.STATES.playing;
  }

  stop(){
    this.#playlist.ui.outputs.audio.pause();
    this.#playlist.ui.outputs.audio.currentTime = 0;
    this.state = Track.STATES.stopped;
  }

  async readTags(){
    this.tags = await new Promise((resolve, reject) => {
      this.#tagReader.read(this.#file, { 
        onSuccess: (result) => resolve(result.tags), 
        onError: (err) => reject(err)
      });
    });

    this.#labels = LabelMaker.makeLabels(this.tags);
  }

  get entry(){
    if(!this.#entry?.classList.contains(this.#state)){
      const entry = create(`<li data-track-index="${this.id}" class="entry ${this.#state}">${this.#labels[this.#state]}</li>`);
      entry.addEventListener('dblclick', () => this.#playlist.playTrack(this));
      this.#entry?.replaceWith(entry);
      this.#entry = entry;
    }
    
    return this.#entry;
  }

  set state(s){
    this.#state = s;
    const entry = this.entry;
    if(s === Track.STATES.playing) entry.classList.add('current');
    else entry.classList.remove('current');
  }

  get state(){
    return this.#state;
  }
}

new App();