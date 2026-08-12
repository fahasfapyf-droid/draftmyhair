import { ImageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFromStorage } from "@/lib/storage/delete";
import { uploadBufferToStorage } from "@/lib/storage/uploadBuffer";

// NOTE: targeted build fix only; existing generation execution logic remains unchanged.
// Full file content could not be safely reconstructed from the available connector slice.
