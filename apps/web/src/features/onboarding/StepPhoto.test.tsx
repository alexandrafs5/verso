import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarImageError } from './avatar-image';
import { StepPhoto } from './StepPhoto';
import { baseMe, bodyOf, json, mockApi, problem, renderWithProviders, t } from './test-utils';

const mocks = vi.hoisted(() => ({
  loadImage: vi.fn(),
  encodeAvatar: vi.fn(),
}));

// jsdom has no canvas or image decoding: the browser-only parts are replaced, the rest is real.
vi.mock('./avatar-image', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('./avatar-image')),
  loadImage: mocks.loadImage,
  encodeAvatar: mocks.encodeAvatar,
}));

const me = { ...baseMe, username: 'ana' };
const UPLOAD_URL = 'https://storage.test/upload/avatars/u1/new.webp?token=tok';
const PNG = () => new File(['x'], 'me.png', { type: 'image/png' });

const fakeImage = { naturalWidth: 400, naturalHeight: 300 } as HTMLImageElement;
const webp = () => new Blob(['webp-bytes'], { type: 'image/webp' });

beforeEach(() => {
  vi.unstubAllGlobals();
  mocks.loadImage.mockReset().mockResolvedValue(fakeImage);
  mocks.encodeAvatar.mockReset().mockResolvedValue(webp());
});

function uploadRoutes(extra: Record<string, () => Response> = {}) {
  const calls: { upload?: unknown; put?: RequestInit; patch?: unknown } = {};
  mockApi({
    'POST /api/v1/me/avatar/upload-url': (init) => {
      calls.upload = bodyOf(init);
      return json({ path: 'avatars/u1/new.webp', uploadUrl: UPLOAD_URL, token: 'tok' });
    },
    'PUT https://storage.test/upload/avatars/u1/new.webp': (init) => {
      calls.put = init;
      return new Response(null, { status: 200 });
    },
    'PATCH /api/v1/me': (init) => {
      calls.patch = bodyOf(init);
      return json({ ...me, image: 'https://storage.test/public/avatars/u1/new.webp' });
    },
    ...extra,
  });
  return calls;
}

describe('StepPhoto (step 2)', () => {
  it('shows the initials fallback with a text alternative and only Skip when there is no photo', () => {
    uploadRoutes();
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByRole('img', { name: /AG/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.skip })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.continue })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.photo.choose })).toBeInTheDocument();
  });

  it('Skip moves on without sending anything', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    const fetchMock = mockApi({});
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={onNext} />);

    await ui.click(screen.getByRole('button', { name: t.skip }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens the crop view after choosing an image', async () => {
    const ui = userEvent.setup();
    uploadRoutes();
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={vi.fn()} />);

    await ui.upload(screen.getByLabelText(t.photo.fileInput), PNG());

    expect(await screen.findByRole('img', { name: t.photo.cropLabel })).toBeInTheDocument();
    expect(screen.getByLabelText(t.photo.zoom)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.photo.save })).toBeInTheDocument();
  });

  it('compresses, uploads through the signed url, saves the path and moves on', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    const calls = uploadRoutes();
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={onNext} />);

    await ui.upload(screen.getByLabelText(t.photo.fileInput), PNG());
    await ui.click(await screen.findByRole('button', { name: t.photo.save }));

    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
    expect(calls.upload).toEqual({ contentType: 'image/webp', size: 'webp-bytes'.length });
    expect(calls.put?.method).toBe('PUT');
    expect(calls.put?.headers).toMatchObject({ 'Content-Type': 'image/webp' });
    expect(calls.put?.body).toBeInstanceOf(Blob);
    expect(calls.patch).toEqual({ avatarPath: 'avatars/u1/new.webp' });
  });

  it('shows a progress state while uploading and disables the controls', async () => {
    const ui = userEvent.setup();
    let finish: (blob: Blob) => void = () => undefined;
    mocks.encodeAvatar.mockReturnValue(new Promise<Blob>((resolve) => (finish = resolve)));
    uploadRoutes();
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={vi.fn()} />);

    await ui.upload(screen.getByLabelText(t.photo.fileInput), PNG());
    await ui.click(await screen.findByRole('button', { name: t.photo.save }));

    expect(screen.getByRole('status')).toHaveTextContent(t.photo.processing);
    expect(screen.getByRole('button', { name: t.saving })).toBeDisabled();
    finish(webp());
  });

  it('rejects a file that is not a supported image and keeps the previous photo', async () => {
    const ui = userEvent.setup({ applyAccept: false });
    uploadRoutes();
    renderWithProviders(
      <StepPhoto
        me={{ ...me, image: 'https://storage.test/public/avatars/u1/old.webp' }}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    await ui.upload(
      screen.getByLabelText(t.photo.fileInput),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(t.photo.errors.wrongType);
    expect(screen.getByRole('img', { name: t.photo.currentAlt })).toHaveAttribute(
      'src',
      'https://storage.test/public/avatars/u1/old.webp',
    );
    expect(mocks.loadImage).not.toHaveBeenCalled();
  });

  it('shows an error when the image cannot be opened', async () => {
    const ui = userEvent.setup();
    mocks.loadImage.mockRejectedValue(new AvatarImageError('unreadable'));
    uploadRoutes();
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={vi.fn()} />);

    await ui.upload(screen.getByLabelText(t.photo.fileInput), PNG());
    expect(await screen.findByRole('alert')).toHaveTextContent(t.photo.errors.unreadable);
  });

  it('shows the too-large error and uploads nothing', async () => {
    const ui = userEvent.setup();
    mocks.encodeAvatar.mockRejectedValue(new AvatarImageError('tooLarge'));
    const fetchMock = uploadRoutes();
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={vi.fn()} />);

    await ui.upload(screen.getByLabelText(t.photo.fileInput), PNG());
    await ui.click(await screen.findByRole('button', { name: t.photo.save }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.photo.errors.tooLarge);
    expect(fetchMock.upload).toBeUndefined();
  });

  it('shows the browser-cannot-encode error and keeps Skip available', async () => {
    const ui = userEvent.setup();
    mocks.encodeAvatar.mockRejectedValue(new AvatarImageError('encode'));
    uploadRoutes();
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={vi.fn()} />);

    await ui.upload(screen.getByLabelText(t.photo.fileInput), PNG());
    await ui.click(await screen.findByRole('button', { name: t.photo.save }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.photo.errors.encode);
    expect(screen.getByRole('button', { name: t.skip })).toBeEnabled();
  });

  it('shows an upload error, saves nothing and stays on the step when storage rejects the file', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    const calls = uploadRoutes();
    mockApi({
      'POST /api/v1/me/avatar/upload-url': () =>
        json({ path: 'avatars/u1/new.webp', uploadUrl: UPLOAD_URL, token: 'tok' }),
      'PUT https://storage.test/upload/avatars/u1/new.webp': () =>
        new Response(null, { status: 403 }),
      'PATCH /api/v1/me': () => {
        calls.patch = 'called';
        return json(me);
      },
    });
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={onNext} />);

    await ui.upload(screen.getByLabelText(t.photo.fileInput), PNG());
    await ui.click(await screen.findByRole('button', { name: t.photo.save }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.photo.errors.upload);
    expect(calls.patch).toBeUndefined();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('shows the upload error when the API cannot sign the upload', async () => {
    const ui = userEvent.setup();
    mockApi({ 'POST /api/v1/me/avatar/upload-url': () => problem(503, 'STORAGE_UNAVAILABLE') });
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={vi.fn()} />);

    await ui.upload(screen.getByLabelText(t.photo.fileInput), PNG());
    await ui.click(await screen.findByRole('button', { name: t.photo.save }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.photo.errors.upload);
  });

  it('removes the current photo through removeAvatar', async () => {
    const ui = userEvent.setup();
    let body: unknown;
    mockApi({
      'PATCH /api/v1/me': (init) => {
        body = bodyOf(init);
        return json({ ...me, image: null });
      },
    });
    renderWithProviders(
      <StepPhoto
        me={{ ...me, image: 'https://storage.test/public/avatars/u1/old.webp' }}
        onBack={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    await ui.click(screen.getByRole('button', { name: t.photo.remove }));
    await waitFor(() => expect(body).toEqual({ removeAvatar: true }));
  });

  it('shows Continue and an alt text for an existing photo', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    mockApi({});
    renderWithProviders(
      <StepPhoto
        me={{ ...me, image: 'https://storage.test/public/avatars/u1/old.webp' }}
        onBack={vi.fn()}
        onNext={onNext}
      />,
    );

    expect(screen.getByRole('img', { name: t.photo.currentAlt })).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: t.continue }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('keeps the crop keyboard operable: focusable, described, with a zoom slider', async () => {
    const ui = userEvent.setup();
    uploadRoutes();
    renderWithProviders(<StepPhoto me={me} onBack={vi.fn()} onNext={vi.fn()} />);

    await ui.upload(screen.getByLabelText(t.photo.fileInput), PNG());
    const crop = await screen.findByRole('img', { name: t.photo.cropLabel });

    expect(crop).toHaveAttribute('tabindex', '0');
    expect(crop).toHaveAccessibleDescription(t.photo.cropHint);
    expect(screen.getByLabelText(t.photo.zoom)).toHaveAttribute('type', 'range');
    crop.focus();
    await ui.keyboard('{ArrowRight}{ArrowDown}');
    expect(crop).toHaveFocus();
  });
});
