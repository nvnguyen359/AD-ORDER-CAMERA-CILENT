import { Component, Input, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';

// [QUAN TRỌNG] Import thư viện nén file
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// --- Interfaces ---
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
  imports: [CommonModule, DialogModule, ButtonModule, TooltipModule],
  templateUrl: './order-video-audit.component.html',
  styleUrls: ['./order-video-audit.component.scss']
})
export class OrderVideoAuditComponent {
  @Input() visible: boolean = false;

  // Cấu hình Backend URL (Đổi IP nếu cần thiết)
  @Input() backendUrl: string = 'http://localhost:8000';

  @Input() set config(value: AuditInputData | null) {
    if (value && value.data && value.data.length > 0) {
      this.processData(value.data, value.id);
    }
  }

  // --- State ---
  auditList: AuditViewModel[] = [];
  selectedAudit: AuditViewModel | null = null;

  // Trạng thái Player
  isPlaying: boolean = false;
  markerPositionPercent: number = 0;
  showMarker: boolean = false;

  // Trạng thái Download
  isDownloading: boolean = false; // Tải 1 file
  isZipping: boolean = false;     // Tải tất cả (Zip)

  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  constructor(private cdr: ChangeDetectorRef) {}

  // --- XỬ LÝ DỮ LIỆU ---
  private processData(rawData: any[], targetId?: number) {
    this.auditList = rawData.map(item => {
      let durationStr = '--:--';
      let totalSeconds = 0;

      if (item.created_at && item.closed_at) {
        const start = new Date(item.created_at).getTime();
        const end = new Date(item.closed_at).getTime();

        if (!isNaN(start) && !isNaN(end)) {
            totalSeconds = Math.floor(Math.abs((end - start) / 1000));
            const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
            const ss = (totalSeconds % 60).toString().padStart(2, '0');
            durationStr = `${mm}:${ss}`;
        }
      }

      // Hàm chuẩn hóa đường dẫn (Fix lỗi Windows Path \)
      const fixPath = (path: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;

        // Thay \ bằng / và xóa / ở đầu
        const normalizedPath = path.replace(/\\/g, '/').replace(/^\//, '');
        // Nối với backendUrl
        return `${this.backendUrl.replace(/\/$/, '')}/${normalizedPath}`;
      };

      const finalVideoPath = fixPath(item.path_video);
      const finalAvatarPath = fixPath(item.path_avatar) || 'assets/images/default-avatar.png';

      const isAuto = item.note && item.note.includes('[Auto]');
      const packerName = item.user_id
        ? `Packer #${item.user_id}`
        : (isAuto ? 'System Auto' : 'Unknown');

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
        packerName: packerName
      };
    });

    this.autoSelectVideo(targetId);
  }

  private autoSelectVideo(targetId?: number) {
    let itemToPlay: AuditViewModel | undefined;
    if (targetId) itemToPlay = this.auditList.find(x => x.id === targetId);

    // Fallback: Tìm video đầu tiên có file
    if (!itemToPlay || !itemToPlay.hasVideo) {
      const sorted = [...this.auditList].sort((a, b) => a.id - b.id);
      itemToPlay = sorted.find(x => x.hasVideo);
    }

    if (itemToPlay) this.selectAudit(itemToPlay);
  }

  // --- ĐIỀU KHIỂN VIDEO ---
  selectAudit(item: AuditViewModel) {
    if (!item.hasVideo) return;

    const player = this.videoPlayer?.nativeElement;

    // Nếu click lại video đang chọn -> Toggle Play/Pause
    if (this.selectedAudit?.id === item.id && player) {
        if (player.paused) player.play().catch(e => console.warn(e));
        else player.pause();
        return;
    }

    this.selectedAudit = item;

    // Marker logic
    if (item.fullDurationSec > 5) {
      this.markerPositionPercent = (5 / item.fullDurationSec) * 100;
      this.showMarker = true;
    } else {
      this.showMarker = false;
    }

    this.cdr.detectChanges();

    if (player) {
      player.load();
      player.play().catch(err => console.warn('Autoplay blocked:', err));
    }
  }

  seekToMarker() {
    if (this.videoPlayer?.nativeElement) {
      this.videoPlayer.nativeElement.currentTime = 5;
      this.videoPlayer.nativeElement.play();
    }
  }

  // --- DOWNLOAD 1 FILE (Video lẻ) ---
  async downloadCurrentVideo() {
    if (!this.selectedAudit || !this.selectedAudit.path_video) return;

    this.isDownloading = true;
    try {
        const response = await fetch(this.selectedAudit.path_video);
        if (!response.ok) throw new Error('Fetch Error');

        const blob = await response.blob();
        const fileName = `VIDEO_${this.selectedAudit.code}.mp4`;

        saveAs(blob, fileName); // Dùng file-saver
    } catch (error) {
        console.error('Download failed:', error);
        alert('Lỗi tải video. Vui lòng thử lại!');
    } finally {
        this.isDownloading = false;
    }
  }

  // --- [TỐI ƯU ORANGE PI] DOWNLOAD ALL (TUẦN TỰ) ---
  async downloadAllAsZip() {
    // 1. Lọc lấy các item có video
    const videosToDownload = this.auditList.filter(x => x.hasVideo && x.path_video);

    if (videosToDownload.length === 0) {
        alert('Không có video nào để tải!');
        return;
    }

    this.isZipping = true;
    const zip = new JSZip();
    const folderName = `Audit_Export_${new Date().getTime()}`;
    const folder = zip.folder(folderName);

    try {
        // 2. Vòng lặp tuần tự (Sequential Loop)
        // Thay vì Promise.all (gửi hàng loạt request), ta dùng for...of + await
        // để tải xong file này mới tải file kia -> Giảm tải I/O cho Orange Pi

        let count = 0;
        const total = videosToDownload.length;

        for (const item of videosToDownload) {
            if (!item.path_video) continue;

            try {
                count++;
                console.log(`[OrangePi Optimized] Downloading ${count}/${total}: ${item.code}`);

                const response = await fetch(item.path_video);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const blob = await response.blob();

                // Đặt tên file trong Zip: ID_MãĐơn.mp4
                const fileName = `${item.id}_${item.code}.mp4`;
                folder?.file(fileName, blob);

            } catch (err) {
                console.error(`Lỗi tải video ${item.code}:`, err);
            }
        }

        // 3. Nén file sau khi tải xong hết
        console.log('Đang nén file...');
        const zipContent = await zip.generateAsync({ type: 'blob' });

        // 4. Lưu file Zip
        saveAs(zipContent, `${folderName}.zip`);

    } catch (error) {
        console.error('Zip failed:', error);
        alert('Có lỗi khi tạo file nén!');
    } finally {
        this.isZipping = false;
    }
  }
}
