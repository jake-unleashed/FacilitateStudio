import { useEffect } from 'react';

interface PopupApi {
  showPopup: (args: { type: 'error'; title: string; message: string }) => void;
}

interface UseErrorPopupsArgs {
  uploadLastError: string | null;
  clearUploadError: () => void;
  projectsError: string | null;
  clearProjectsError: () => void;
  popupApi: PopupApi;
}

export function useErrorPopups(args: UseErrorPopupsArgs): void {
  const { uploadLastError, clearUploadError, projectsError, clearProjectsError, popupApi } = args;

  useEffect(() => {
    if (uploadLastError) {
      popupApi.showPopup({
        type: 'error',
        title: 'Upload Failed',
        message: uploadLastError,
      });
      clearUploadError();
    }
  }, [uploadLastError, popupApi, clearUploadError]);

  useEffect(() => {
    if (!projectsError) return;
    popupApi.showPopup({
      type: 'error',
      title: 'Cloud Sync Failed',
      message: projectsError,
    });
    clearProjectsError();
  }, [projectsError, popupApi, clearProjectsError]);
}
