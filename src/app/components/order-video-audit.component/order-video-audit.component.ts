import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';

// Import thư viện nén file
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { environment } from '../../environments/environment';
import { OrderStatus } from '../../core/models/stream.model';
import { OrderStatusPipe } from '../../shared/pipes/order-status-pipe';

export interface AuditInputData {
  data: any[];
  id?: number;
}

export interface AuditViewModel {
  id: number;
  path_avatar: string;
  path_video: string | null;
  hasVideo: boolean;
  created_at: string;
  closed_at: string | null;
  displayDuration: string;
  fullDurationSec: number;
  note: string;
  status: string;
  code: string;
  packerName: string;
}

@Component({
  selector: 'app-order-video-audit',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TooltipModule, OrderStatusPipe],
  templateUrl: './order-video-audit.component.html',
  styleUrls: ['./order-video-audit.component.scss'],
})
export class OrderVideoAuditComponent {
  // --- INPUTS & OUTPUTS ---
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() backendUrl: string = 'http://localhost:8000';

  @Input() set config(value: AuditInputData | null) {
    if (value && value.data && value.data.length > 0) {
      this.processData(value.data, value.id);
    }
  }
  showAuditList = false;

  // --- STATE ---
  auditList: AuditViewModel[] = [];
  selectedAudit: AuditViewModel | null = null;

  // Player State
  isPlaying: boolean = false;
  markerPositionPercent: number = 0;
  showMarker: boolean = false;

  // Loading State
  isDownloading: boolean = false;
  isZipping: boolean = false;

  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  constructor(private cdr: ChangeDetectorRef) {}

  // --- HANDLER DIALOG ---
  onDialogVisibleChange(value: boolean) {
    this.visible = value;
    this.visibleChange.emit(value);

    // Stop video khi đóng dialog
    if (!value && this.videoPlayer?.nativeElement) {
      this.videoPlayer.nativeElement.pause();
      this.isPlaying = false;
    }
  }

  // --- PROCESS DATA ---
  private processData(rawData: any[], targetId?: number) {
    this.showAuditList = this.auditList.length > 0;
    this.auditList = rawData.map((item) => {
      let durationStr = '--:--';
      let totalSeconds = 0;

      if (item.created_at && item.closed_at) {
        const start = new Date(item.created_at).getTime();
        const end = new Date(item.closed_at).getTime();
        if (!isNaN(start) && !isNaN(end)) {
          totalSeconds = Math.floor(Math.abs((end - start) / 1000));
          const mm = Math.floor(totalSeconds / 60)
            .toString()
            .padStart(2, '0');
          const ss = (totalSeconds % 60).toString().padStart(2, '0');
          durationStr = `${mm}:${ss}`;
        }
      }

      // Hàm chuẩn hóa Path (Windows -> Web)
      const fixPath = (path: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;

        // Xóa dấu \ và / thừa
        const normalizedPath = path.replace(/\\/g, '/').replace(/^\//, '');
        // Nối với backendUrl
        return `${this.backendUrl.replace(/\/$/, '')}/${normalizedPath}`;
      };

      const finalVideoPath = fixPath(item.path_video);

      // [FIX QUAN TRỌNG] Fallback về 'no-avatar.png' nếu path null
      const finalAvatarPath = fixPath(item.path_avatar) || environment.noImage;

      const isAuto = item.note && item.note.includes('[Auto]');
      const packerName = item.user_id
        ? `Packer #${item.user_id}`
        : isAuto
        ? 'System Auto'
        : 'Unknown';
      return {
        id: item.id,
        path_avatar: finalAvatarPath,
        path_video: finalVideoPath,
        hasVideo: !!finalVideoPath,
        created_at: item.created_at,
        closed_at: item.closed_at,
        displayDuration: durationStr,
        fullDurationSec: totalSeconds,
        note: item.note || '',
        status: item.status,
        code: item.code,
        packerName: packerName,
      };
    });

    this.autoSelectVideo(targetId);
  }

  private autoSelectVideo(targetId?: number) {
    let itemToPlay: AuditViewModel | undefined;
    if (targetId) itemToPlay = this.auditList.find((x) => x.id === targetId);

    if (!itemToPlay || !itemToPlay.hasVideo) {
      const sorted = [...this.auditList].sort((a, b) => a.id - b.id);
      itemToPlay = sorted.find((x) => x.hasVideo);
    }

    if (itemToPlay) this.selectAudit(itemToPlay);
  }

  // --- PLAYER ACTIONS ---
  selectAudit(item: AuditViewModel) {
    if (!item.hasVideo) return;
    const player = this.videoPlayer?.nativeElement;

    if (this.selectedAudit?.id === item.id && player) {
      if (player.paused) player.play().catch((e) => console.warn(e));
      else player.pause();
      return;
    }

    this.selectedAudit = item;

    if (item.fullDurationSec > 5) {
      this.markerPositionPercent = (5 / item.fullDurationSec) * 100;
      this.showMarker = true;
    } else {
      this.showMarker = false;
    }

    this.cdr.detectChanges();

    if (player) {
      player.load();
      player.play().catch((err) => console.warn('Autoplay blocked:', err));
    }
  }

  seekToMarker() {
    if (this.videoPlayer?.nativeElement) {
      this.videoPlayer.nativeElement.currentTime = 5;
      this.videoPlayer.nativeElement.play();
    }
  }

  // --- DOWNLOAD ---
  async downloadCurrentVideo() {
    if (!this.selectedAudit || !this.selectedAudit.path_video) return;

    this.isDownloading = true;
    try {
      const response = await fetch(this.selectedAudit.path_video);
      if (!response.ok) throw new Error('Fetch Error');
      const blob = await response.blob();
      saveAs(blob, `VIDEO_${this.selectedAudit.code}.mp4`);
    } catch (error) {
      alert('Lỗi tải video!');
    } finally {
      this.isDownloading = false;
    }
  }

  async downloadAllAsZip() {
    const videosToDownload = this.auditList.filter((x) => x.hasVideo && x.path_video);
    if (videosToDownload.length === 0) {
      alert('Không có video nào!');
      return;
    }

    this.isZipping = true;
    const zip = new JSZip();
    const folderName = `Audit_Export_${new Date().getTime()}`;
    const folder = zip.folder(folderName);

    try {
      let count = 0;
      const total = videosToDownload.length;

      for (const item of videosToDownload) {
        if (!item.path_video) continue;
        try {
          count++;
          console.log(`Downloading ${count}/${total}: ${item.code}`);
          const response = await fetch(item.path_video);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          folder?.file(`${item.id}_${item.code}.mp4`, blob);
        } catch (err) {
          console.error(`Lỗi file ${item.code}`, err);
        }
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      saveAs(zipContent, `${folderName}.zip`);
    } catch (error) {
      alert('Lỗi tạo file nén!');
    } finally {
      this.isZipping = false;
    }
  }
}
