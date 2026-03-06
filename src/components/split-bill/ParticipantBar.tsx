"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { useSplitBill } from "@/components/split-bill/split-bill-context";
import { cn, getAvatarUrl } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ParticipantBarProps {
  activeParticipantId: string | null;
  onSetActive: (id: string | null) => void;
}

export function ParticipantBar({
  activeParticipantId,
  onSetActive,
}: ParticipantBarProps) {
  const { state, dispatch } = useSplitBill();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [participantToDelete, setParticipantToDelete] = useState<string | null>(null);

  const handleAddParticipant = () => {
    dispatch({ type: "ADD_PARTICIPANT" });
  };

  const handleStartEdit = (participantId: string, currentName: string) => {
    setEditingId(participantId);
    setEditingName(currentName);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      dispatch({
        type: "UPDATE_PARTICIPANT_NAME",
        id: editingId,
        name: editingName.trim(),
      });
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleParticipantClick = (participantId: string) => {
    if (!editingId) {
      onSetActive(activeParticipantId === participantId ? null : participantId);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, participantId: string) => {
    e.stopPropagation();
    setParticipantToDelete(participantId);
  };

  const handleDeleteConfirm = useCallback((participantId: string) => {
    dispatch({
      type: "REMOVE_PARTICIPANT",
      id: participantId,
    });
    if (activeParticipantId === participantId) {
      onSetActive(null);
    }
    setParticipantToDelete(null);
  }, [dispatch, activeParticipantId, onSetActive]);

  const handleDeleteCancel = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setParticipantToDelete(null);
  }, []);

  const participantToDeleteName = state.participants.find(
    (p) => p.id === participantToDelete
  )?.name;

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2">
      {/* Add participant button */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleAddParticipant}
        className="shrink-0 rounded-full"
        aria-label="Tambah peserta"
      >
        <Plus className="h-4 w-4" />
      </Button>

      {/* Participant circles */}
      {state.participants.map((participant) => (
        <div
          key={participant.id}
          className="flex shrink-0 flex-col items-center gap-1"
        >
          <button
            onClick={() => handleParticipantClick(participant.id)}
            className={cn(
              "relative flex size-12 items-center justify-center rounded-full border-2 transition-all",
              activeParticipantId === participant.id
                ? "border-primary ring-2 ring-primary/20"
                : "border-muted-foreground/30 hover:border-muted-foreground/50",
            )}
          >
            <div className="relative size-full overflow-hidden rounded-full bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAvatarUrl(participant.name)}
                alt={participant.name}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Edit name overlay for non-owner */}
            {!participant.isOwner && !editingId && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100 hover:bg-black/5">
                <span className="text-[10px] text-muted-foreground">Edit</span>
              </div>
            )}
          </button>

          {/* Participant name - editable */}
          {editingId === participant.id ? (
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveEdit();
                } else if (e.key === "Escape") {
                  handleCancelEdit();
                }
              }}
              autoFocus
              className="h-6 w-20 px-1 text-center text-xs"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              onClick={() =>
                !participant.isOwner &&
                handleStartEdit(participant.id, participant.name)
              }
              className={cn(
                "max-w-20 truncate text-xs",
                !participant.isOwner && "hover:text-primary hover:underline",
              )}
              title={participant.name}
            >
              {participant.name}
            </button>
          )}

          {/* Delete button or placeholder for symmetry */}
          {!participant.isOwner ? (
            <button
              onClick={(e) => handleDeleteClick(e, participant.id)}
              className="text-[10px] text-destructive hover:text-destructive/80 select-none px-2 py-1"
              aria-label="Hapus peserta"
            >
              Hapus
            </button>
          ) : (
            <div className="text-[10px] invisible select-none px-2 py-1" aria-hidden="true">
              Hapus
            </div>
          )}
        </div>
      ))}

      {/* Delete confirmation dialog moved outside the map loop */}
      <AlertDialog
        open={participantToDelete !== null}
        onOpenChange={(open) => !open && setParticipantToDelete(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Peserta?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda yakin ingin menghapus peserta{" "}
              <strong>{participantToDeleteName}</strong>
              ? Semua pembagian item untuk peserta ini akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (participantToDelete) {
                  handleDeleteConfirm(participantToDelete);
                }
              }}
              variant="destructive"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
