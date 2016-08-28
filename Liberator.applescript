on logger(logString)
	set logFile to "iMessageLiberator"
	do shell script "echo `date '+%Y-%m-%d %T: '`\"" & logString & "\" >> $HOME/Library/Logs/" & logFile & ".log"
end logger

using terms from application "Messages"
	on rpc(theBuddy, theMessage, theType, theEventName)
		set theServiceId to (id of service of theBuddy)
		set theServiceType to (service type of service of theBuddy)
		set theHandle to (handle of theBuddy)
		set theFullName to (full name of theBuddy)

		my logger("(" & theEventName & ", " & theType & ") [" & theMessage & "] from [" & theFullName & ", " & theHandle & ", " & theServiceId & ", " & theServiceType & "]")

		if theServiceType is "iMessage" then
			try
				set scriptName to "liberateMessage.sh"
				set scriptName to (do shell script ("eval `/usr/libexec/path_helper -s`; which " & scriptName))
				do shell script scriptName & " \"" & theMessage & "\" \"" & theFullName & "\""
			on error e number n
				my logger("ERROR: " & e & " " & n)
			end try
		end if
	end rpc

	on processEvent(eventName, theMessage, theBuddy)
		if contents of theMessage is not "" then
			my rpc(theBuddy, theMessage, "text", eventName)

		-- `completed file transfer` event is broken
		else if direction of last file transfer is incoming then
			-- compare diff in seconds
			if (current date) - (started of last file transfer) < 5 then
				set f to file of the last file transfer
				set fileName to POSIX path of f
				my rpc(theBuddy, fileName, "file", eventName)
			end if
		end if
	end processEvent

	on message received theMessage from theBuddy for theChat
		my processEvent("message received", theMessage, theBuddy)
	end message received

	on chat room message received theMessage from theBuddy for theChat
		my processEvent("chat room message received", theMessage, theBuddy)
	end chat room message received

	on addressed chat room message received theMessage from theBuddy for theChat
		my processEvent("addressed chat room message received", theMessage, theBuddy)
	end addressed chat room message received

	on addressed message received theMessage from theBuddy for theChat
		my processEvent("addressed message received", theMessage, theBuddy)
	end addressed message received

	on active chat message received theMessage from theBuddy for theChat
		my processEvent("active chat message received", theMessage, theBuddy)
	end active chat message received

	on received text invitation theText from theBuddy for theChat
		if contents of theMessage is not "" then
			my rpc((id of service of theBuddy), (handle of theBuddy), (full name of theBuddy), theMessage, "msg", "received text invitation")
		end if
	end received text invitation

	on completed file transfer theFile
		if direction of theFile is incoming then
			my rpc((id of service of buddy of theFile), (handle of buddy of theFile), (full name of buddy of theFile), (id of theFile), "file", "completed file transfer")
		end if
	end completed file transfer

	# The following are unused but need to be defined to avoid an error

	on message sent theMessage for theChat

	end message sent

	on received audio invitation theText from theBuddy for theChat

	end received audio invitation

	on received video invitation theText from theBuddy for theChat

	end received video invitation

	on buddy authorization requested theRequest

	end buddy authorization requested

	on av chat started

	end av chat started

	on av chat ended

	end av chat ended

	on received file transfer invitation theFileTransfer

	end received file transfer invitation

	on login finished for theService

	end login finished

	on logout finished for theService

	end logout finished

	on buddy became available theBuddy

	end buddy became available

	on buddy became unavailable theBuddy

	end buddy became unavailable

end using terms from